# Validation Plan

> The decision this repo exists to answer (PRD §8, North Star §11): **build vs. abandon.**
> We don't build for months in a cave — we get signal cheaply, then decide.

Two bets run in parallel. Either one failing is a reason to stop.

---

## Track 1 — Technical bet (the kill criterion)

**Question:** Can we rewrite AI text so it beats real detectors *and* stays grammatically clean?

**Tooling:** `eval/` harness (see `eval/README.md`). Free Gemini key, no paid spend.

**Method:**
1. Fixed corpus of AI-flavored samples → rewrite at light/standard/heavy.
2. Score original vs. humanized against **real** detectors (GPTZero, ZeroGPT, Sapling) — not our heuristic.
3. Log scores + a clean-read yes/no in the run report.

**Thresholds:**

| Outcome | Reading |
|---|---|
| ✅ **Go** | Humanized output scores **< 30% AI** on GPTZero on ≥70% of samples AND reads clean (no grammar breakage). |
| 🟡 **Iterate** | Scores drop but inconsistently, or some genres break. Tune prompts (`api/humanize/route.ts`), re-run. This is the loop. |
| ❌ **Kill / pivot** | Can't get below detection without garbling text, even after prompt iteration + a stronger model. Pivot to honest "writing refinement" framing (North Star §10 hedge). |

**Known gap to address while iterating:** the engine runs `gemini-1.5-flash-latest` — cheap/older. If Flash plateaus, test a stronger model before declaring a kill.

---

## Track 2 — Market bet (demand)

**Question:** Do enough people want *the honest, actually-works* version to pay?

**Tooling:** `/waitlist` landing page + `/api/waitlist` capture (writes `eval/waitlist.jsonl`).

**Method:**
1. Landing page leads with the North Star promise (works / controls / transparent).
2. Drive a small amount of traffic to it; capture email + user segment.
3. Mine competitor pain in parallel — Reddit (r/college, r/ChatGPT), Trustpilot, YouTube comments on competitor reviews. Catalog the top recurring complaints; they're our positioning.

**Thresholds:**

| Outcome | Reading |
|---|---|
| ✅ **Go** | Meaningful signup rate from cold traffic + clear, repeated demand for "one that actually works" in competitor channels. |
| 🟡 **Iterate** | Interest but fuzzy segment. Sharpen the headline / target one segment (students vs. marketers). |
| ❌ **Kill** | No one bites and competitor channels show the problem is "solved enough." |

> ⚠️ Deploying the landing page to public traffic is the real demand test, and it's gated on
> hosting — which I can't advise on here. Ask in the **`ai-support` Slack channel** for the
> hosting path. Until then the page + capture run locally for review.

---

## The loop

1. Get the free Gemini key in.
2. `npm run eval` → score against real detectors → read Track 1 numbers.
3. If iterating: tune prompts / model, re-run. If clean wins: stand up Track 2 traffic.
4. Revisit thresholds. Decide: build, iterate, or pivot.

Decisions get logged in `NORTH_STAR.md` §11.
