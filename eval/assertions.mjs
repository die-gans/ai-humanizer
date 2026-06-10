/**
 * Structured assertions — fast, deterministic, no LLM. Adapted from dans-blog's
 * prompt-regression layer for the humanizer's failure modes: dropped/ballooned
 * content, banned AI tells, no-op rewrites.
 *
 * Returns { passRate, results: [{ name, passed, detail }] }.
 */

const BANNED_PHRASES = [
  "delve into",
  "leverage",
  "in conclusion",
  "it is important to note",
  "it's important to note",
  "furthermore",
  "moreover",
  "tapestry",
  "navigating the",
  "in today's fast-paced world",
];

function words(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function runAssertions(original, humanized, { maxWordDelta = 0.4 } = {}) {
  const oW = words(original);
  const hW = words(humanized);
  const delta = oW ? Math.abs(hW - oW) / oW : 0;
  const lower = humanized.toLowerCase();
  const banned = BANNED_PHRASES.filter((p) => lower.includes(p));

  const results = [
    { name: "non_empty", passed: hW > 0, detail: `${hW} words` },
    { name: "min_words", passed: hW >= 5, detail: `${hW} ≥ 5` },
    {
      name: "changed",
      passed: humanized.trim() !== original.trim(),
      detail: "output differs from input",
    },
    {
      name: "word_count_delta",
      passed: delta <= maxWordDelta,
      detail: `${(delta * 100).toFixed(0)}% (≤ ${(maxWordDelta * 100).toFixed(0)}%)`,
    },
    {
      name: "no_banned_phrases",
      passed: banned.length === 0,
      detail: banned.length ? `found: ${banned.join(", ")}` : "none",
    },
  ];

  const passed = results.filter((r) => r.passed).length;
  return { passRate: passed / results.length, passed, total: results.length, results };
}
