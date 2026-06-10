#!/usr/bin/env node
/**
 * Humanizer eval harness.
 *
 * Hits the running dev server's real /api/humanize and /api/detect routes
 * (so we test the exact production code path + prompts), then writes a
 * markdown report you can paste into REAL detector web UIs to record scores.
 *
 * Why this design: the built-in /api/detect heuristic is a rough proxy, NOT
 * a real detector — it would be marking our own homework. The authoritative
 * signal is GPTZero / ZeroGPT / Sapling. This harness automates everything
 * except that final human step, and gives you a pre-filled table to record it.
 *
 * Usage:
 *   1. Add GOOGLE_API_KEY to .env.local (free key from aistudio.google.com)
 *   2. npm run dev          (in one terminal)
 *   3. node eval/run-eval.mjs [--intensity standard] [--server http://localhost:3000]
 *
 * Output: eval/results/run-<timestamp>.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- args ----
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const SERVER = arg("server", "http://localhost:3000");
const INTENSITIES = arg("intensity", "light,standard,heavy").split(",").map((s) => s.trim());
const TONE = arg("tone", "casual");

// ---- load corpus ----
const corpus = JSON.parse(readFileSync(join(__dirname, "corpus.json"), "utf-8"));
const samples = corpus.samples;

async function post(path, body) {
  const res = await fetch(`${SERVER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${path} -> ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function heuristicPct(detect) {
  // detect.heuristic.overall looks like "45% AI (heuristic)"
  const m = detect?.heuristic?.overall?.match(/(\d+)%/);
  return m ? Number(m[1]) : null;
}

async function main() {
  console.log(`Server:      ${SERVER}`);
  console.log(`Intensities: ${INTENSITIES.join(", ")}`);
  console.log(`Samples:     ${samples.length}`);
  console.log("");

  // Sanity check: is the server up + is a real key configured (not mock mode)?
  let mockWarning = "";
  try {
    const probe = await post("/api/humanize", {
      text: "This is a short probe sentence to check whether the engine is live.",
      purpose: "blog",
      tone: "casual",
      intensity: "light",
    });
    // Mock mode tends to just prepend a filler word / swap contractions and leave length identical.
    // We can't perfectly detect it, so we just note it for the user to eyeball.
    if (!probe.humanized) mockWarning = "⚠️  No humanized text returned from probe.";
  } catch (e) {
    console.error(`\n❌ Could not reach ${SERVER}. Is \`npm run dev\` running?\n   ${e.message}\n`);
    process.exit(1);
  }

  const rows = [];
  for (const sample of samples) {
    for (const intensity of INTENSITIES) {
      process.stdout.write(`• ${sample.id} [${intensity}] ... `);
      try {
        const h = await post("/api/humanize", {
          text: sample.text,
          purpose: sample.purpose,
          tone: TONE,
          intensity,
        });
        const dOrig = await post("/api/detect", { text: sample.text });
        const dHuman = await post("/api/detect", { text: h.humanized });
        const heurHuman = heuristicPct(dHuman);

        // Push the heuristic score to the humanize trace in Langfuse so eval
        // runs populate the dashboard. Real GPTZero scores get added by traceId
        // after the manual web-UI step.
        if (h.traceId && heurHuman != null) {
          await post("/api/score", {
            traceId: h.traceId,
            scores: [{ name: "heuristic_ai_pct", value: heurHuman, comment: `eval ${intensity}` }],
          }).catch(() => {});
        }

        rows.push({
          id: sample.id,
          genre: sample.genre,
          intensity,
          traceId: h.traceId ?? null,
          original: sample.text,
          humanized: h.humanized,
          wordsOrig: h.wordCount?.original ?? null,
          wordsHuman: h.wordCount?.humanized ?? null,
          heurOrig: heuristicPct(dOrig),
          heurHuman,
        });
        console.log(`done ${h.mode ? `(${h.mode})` : ""}`);
      } catch (e) {
        console.log("FAILED");
        console.error(`   ${e.message}`);
      }
    }
  }

  // ---- build report ----
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(__dirname, "results");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `run-${stamp}.md`);

  let md = `# Humanizer Eval Run — ${stamp}\n\n`;
  md += `- Server: \`${SERVER}\`\n- Tone: \`${TONE}\`\n- Intensities: \`${INTENSITIES.join(", ")}\`\n`;
  if (mockWarning) md += `- ${mockWarning}\n`;
  md += `\n> **Heuristic % is our built-in proxy, NOT a real detector.** Paste each humanized\n`;
  md += `> sample into GPTZero / ZeroGPT / Sapling and record the real "% AI" in the table below.\n`;
  md += `> The bet is validated only if real-detector scores drop meaningfully while the text stays clean.\n\n`;

  // Scoreboard table (fill the last two columns by hand from real detectors)
  md += `## Scoreboard\n\n`;
  md += `| Sample | Genre | Intensity | Words (o→h) | Heuristic %AI (o→h) | GPTZero %AI (humanized) | ZeroGPT %AI (humanized) | Reads clean? (y/n) | Trace |\n`;
  md += `|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    md += `| ${r.id} | ${r.genre} | ${r.intensity} | ${r.wordsOrig}→${r.wordsHuman} | ${r.heurOrig}→${r.heurHuman} |  |  |  | ${r.traceId ? r.traceId.slice(0, 8) : "—"} |\n`;
  }

  // Full text pairs for copy-paste
  md += `\n---\n\n## Text pairs (paste the HUMANIZED block into a real detector)\n`;
  for (const r of rows) {
    md += `\n### ${r.id} — ${r.intensity}\n\n`;
    md += `**Original (heuristic ${r.heurOrig}% AI):**\n\n> ${r.original.replace(/\n/g, "\n> ")}\n\n`;
    md += `**Humanized (heuristic ${r.heurHuman}% AI):**\n\n> ${r.humanized.replace(/\n/g, "\n> ")}\n\n`;
  }

  writeFileSync(outPath, md);
  console.log(`\n✅ Report written: ${outPath}`);
  console.log(`   Next: open it, paste each humanized block into gptzero.me / zerogpt.com,`);
  console.log(`   fill the scoreboard, and we read the real numbers together.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
