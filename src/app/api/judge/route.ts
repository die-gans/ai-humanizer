import { NextRequest, NextResponse, after } from "next/server";
import { generateText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { langfuse } from "@/lib/langfuse";

// LLM call + Langfuse client need the Node.js runtime.
export const runtime = "nodejs";

// Cheap judge model (a separate, consistent evaluator — it needn't be as strong
// as the generation model). Adapted from dans-blog's LLM-as-judge layer.
const JUDGE_MODEL = process.env.JUDGE_MODEL || "google/gemini-2.5-flash-lite";

function resolveJudgeModel(): { model: LanguageModel; label: string } | null {
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    return { model: JUDGE_MODEL, label: `gateway:${JUDGE_MODEL}` };
  }
  const key = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (key && key.length >= 10) {
    return { model: createGoogleGenerativeAI({ apiKey: key })("gemini-2.5-flash"), label: "gemini:gemini-2.5-flash" };
  }
  return null;
}

/**
 * Scores a humanized rewrite on the half of the kill criterion detectors can't
 * measure: did it preserve meaning, and does it read like clean human writing?
 * Attaches judge_faithfulness + judge_quality (0-1) to the humanize trace.
 *
 * Body: { traceId, original, humanized }
 */
export async function POST(req: NextRequest) {
  try {
    const { traceId, original, humanized } = await req.json();
    if (!traceId || !original || !humanized) {
      return NextResponse.json(
        { error: "traceId, original, humanized are required" },
        { status: 400 }
      );
    }

    const resolved = resolveJudgeModel();
    if (!resolved) {
      return NextResponse.json(
        { error: "No judge model available (set AI Gateway auth or GOOGLE_API_KEY)" },
        { status: 503 }
      );
    }

    const prompt = `You are an expert evaluator of text "humanization" — rewrites meant to read as natural human writing while preserving the original's meaning.

ORIGINAL:
"""${String(original).slice(0, 2000)}"""

HUMANIZED:
"""${String(humanized).slice(0, 2000)}"""

Score 0.00 to 1.00:
- faithfulness: Does the humanized version preserve the original's meaning and facts, with nothing added or dropped? (1 = perfectly faithful)
- quality: Is it grammatically clean, natural, and free of awkward/robotic phrasing? (1 = reads like a fluent human wrote it)

Respond with ONLY valid JSON:
{"faithfulness": number, "quality": number, "reasoning": "one sentence"}`;

    const { text } = await generateText({
      model: resolved.model,
      prompt,
      temperature: 0,
      maxOutputTokens: 300,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Judge returned no JSON", raw: text.slice(0, 200) }, { status: 502 });
    }
    const parsed = JSON.parse(match[0]);
    const faithfulness = Number(parsed.faithfulness);
    const quality = Number(parsed.quality);
    const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : undefined;

    if (Number.isFinite(faithfulness)) {
      langfuse.score.create({ traceId, name: "judge_faithfulness", value: faithfulness, comment: reasoning });
    }
    if (Number.isFinite(quality)) {
      langfuse.score.create({ traceId, name: "judge_quality", value: quality, comment: reasoning });
    }

    after(async () => {
      await langfuse.flush();
    });

    return NextResponse.json({ ok: true, judge: resolved.label, faithfulness, quality, reasoning });
  } catch (error: any) {
    console.error("Judge error:", error);
    return NextResponse.json({ error: error.message || "Judge failed" }, { status: 500 });
  }
}
