# AI Humanizer

> Transform AI-generated text into natural, human-like prose. Built to beat detection tools.

## Overview

AI Humanizer is a Next.js application that takes robotic, AI-generated text and rewrites it with natural rhythm, varied sentence structure, and authentic voice. The goal is simple: **make AI text undetectable** while preserving meaning.

This POC validates the core concept before committing to full production build.

## Why This Exists

Current humanizers (TheHumanizer.ai, Undetectable.ai, StealthGPT) are:
- **Expensive** ($9-40/mo for basic tiers)
- **Ineffective** (14/16 fail modern detectors per independent testing)
- **Opaque** (no visibility into what changes are made)
- **One-size-fits-all** (no control over tone, purpose, or intensity)

We can do better.

## Features

- **Purpose-aware rewriting** — Academic, blog, marketing, technical, creative, casual
- **Tone control** — Formal, casual, simple, complex
- **Intensity slider** — Light, standard, heavy transformations
- **Real-time detection scoring** — Heuristic analysis + GPTZero integration
- **Side-by-side diff** — See exactly what changed
- **Dark theme** — Easy on the eyes

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Google Generative AI (Gemini) / OpenRouter (multi-provider)

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── humanize/route.ts    # Main humanization API
│   │   │   └── detect/route.ts      # Detection scoring API
│   │   ├── page.tsx                  # Main UI
│   │   └── layout.tsx                # Root layout
│   ├── components/ui/                # shadcn components
│   └── lib/utils.ts
├── PRD.md                            # Product Requirements Document
├── NORTH_STAR.md                     # Project manifesto & principles
└── README.md                         # This file
```

## Docs

- **[PRD.md](PRD.md)** — Full competitive analysis, feature spec, build plan
- **[NORTH_STAR.md](NORTH_STAR.md)** — Core principles: works, controls, transparent

## Running Locally

```bash
npm install
npm run dev
```

Set `GOOGLE_API_KEY` or `OPENROUTER_API_KEY` in `.env.local` for LLM-powered humanization. Without a key, falls back to mock mode.

## Status

**POC Phase** — Validating AI engine quality and bypass rates before production build.

## License

MIT
