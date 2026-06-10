# Eval Harness

Tests the **kill-criterion** bet: *can we rewrite AI text so it beats real detectors while staying grammatically clean?*

## Workflow

```bash
# 1. Free key from aistudio.google.com → .env.local
echo 'GOOGLE_API_KEY=your_key' >> .env.local

# 2. Start the app (one terminal)
npm run dev

# 3. Run the harness (another terminal)
npm run eval                          # all intensities, default corpus, assertions on
node eval/run-eval.mjs --intensity standard --tone casual
node eval/run-eval.mjs --models "google/gemini-2.5-flash,openai/gpt-5.4"   # provider sweep (needs gateway)
node eval/run-eval.mjs --corpus robustness                                # hard inputs (code, citations, non-English)
node eval/run-eval.mjs --judge                                            # add LLM-as-judge (faithfulness/quality)
```

## Eval layers (adapted from dans-blog)

1. **Structured assertions** (always on, free, no LLM) — per output: non-empty, min words,
   changed, word-count delta in bounds, no banned AI phrases. Failures are listed in the report
   and pushed to Langfuse as `assertions_pass_rate`.
2. **LLM-as-judge** (`--judge`, opt-in — costs LLM calls) — scores `judge_faithfulness`
   (meaning preserved) and `judge_quality` (reads clean/human) 0-1 via `/api/judge`, attached
   to each trace. This is the half of the kill criterion detectors can't measure.
3. **Robustness corpus** (`--corpus robustness`) — adversarial inputs that break humanizers
   (code blocks, citations, lists, Spanish, edge lengths). Watch `word_count_delta` and judge
   faithfulness here.

Together with the detector scores, a trace carries the full picture: **beats detection** (heuristic/GPTZero)
**and didn't garble the text** (assertions + judge).

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
