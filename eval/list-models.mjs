#!/usr/bin/env node
/**
 * Lists AI Gateway model slugs you can plug into HUMANIZE_MODEL for the
 * detector-bypass sweep. Slugs drift, so confirm here before hardcoding.
 *
 * Usage:
 *   npm run models            # all models
 *   npm run models gemini     # filter by substring
 *
 * Needs AI Gateway auth: either VERCEL_OIDC_TOKEN (run `vercel env pull .env.local`)
 * or AI_GATEWAY_API_KEY. We load .env.local ourselves so it works standalone.
 */
import { gateway } from "ai";
import { readFileSync } from "node:fs";

// Minimal .env.local loader (don't override already-set vars).
try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* no .env.local — rely on ambient env */ }

if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  console.error(
    "No AI Gateway auth found.\n" +
      "  → Run `vercel env pull .env.local` (OIDC, recommended), or set AI_GATEWAY_API_KEY."
  );
  process.exit(1);
}

const filter = process.argv[2]?.toLowerCase();

try {
  const res = await gateway.getAvailableModels();
  const models = res?.models ?? (Array.isArray(res) ? res : []);
  const rows = models
    .map((m) => ({ id: m.id ?? m, name: m.name }))
    .filter((m) => !filter || String(m.id).toLowerCase().includes(filter))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const m of rows) {
    console.log(`${m.id}${m.name ? `  — ${m.name}` : ""}`);
  }
  console.log(`\n${rows.length}${filter ? ` matching "${filter}"` : ""} of ${models.length} models`);
} catch (e) {
  console.error("Failed to fetch models:", e.message);
  process.exit(1);
}
