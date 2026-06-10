# Eval Harness

Tests the **kill-criterion** bet: *can we rewrite AI text so it beats real detectors while staying grammatically clean?*

## Workflow

```bash
# 1. Free key from aistudio.google.com → .env.local
echo 'GOOGLE_API_KEY=your_key' >> .env.local

# 2. Start the app (one terminal)
npm run dev

# 3. Run the harness (another terminal)
npm run eval                          # all intensities
node eval/run-eval.mjs --intensity standard --tone casual
```

It hits the **real** `/api/humanize` + `/api/detect` routes (same code path as the app),
then writes `eval/results/run-<timestamp>.md`.

## The manual step that matters

The report's heuristic % is **our own proxy — not a real detector.** The actual signal
comes from pasting each humanized block into a real detector:

- [GPTZero](https://gptzero.me) — the one most schools use
- [ZeroGPT](https://zerogpt.com)
- [Sapling](https://sapling.ai/ai-content-detector)

Record the real "% AI" in the report's scoreboard table, plus a yes/no on whether the
text still reads clean. Then we read the numbers together and decide.

## Files

- `corpus.json` — fixed set of AI-flavored samples (academic/blog/marketing/technical)
- `run-eval.mjs` — the runner
- `results/` — timestamped reports (gitignored-worthy)
- `waitlist.jsonl` — captured signups from the market track (created on first signup)
