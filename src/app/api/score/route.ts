import { NextRequest, NextResponse, after } from "next/server";
import { langfuse } from "@/lib/langfuse";

// LangfuseClient runs on the Node.js runtime.
export const runtime = "nodejs";

type IncomingScore = { name?: string; value?: number; comment?: string };

/**
 * Attaches detector scores to an existing humanize trace.
 *
 * Body: { traceId: string, scores: [{ name, value, comment? }] }
 *
 * This is the payoff of the tuning loop: every humanize run can carry its
 * detector results (heuristic %, GPTZero %, or a hand-recorded real-detector
 * score) so we can filter/compare which prompts & settings lower detection.
 * Called by the UI after detection, and by the eval harness by traceId.
 */
export async function POST(req: NextRequest) {
  try {
    const { traceId, scores } = (await req.json()) as {
      traceId?: string;
      scores?: IncomingScore[];
    };

    if (!traceId || !Array.isArray(scores)) {
      return NextResponse.json(
        { error: "traceId and scores[] are required" },
        { status: 400 }
      );
    }

    let recorded = 0;
    for (const s of scores) {
      if (!s?.name || typeof s.value !== "number" || Number.isNaN(s.value)) continue;
      langfuse.score.create({
        traceId,
        name: s.name,
        value: s.value,
        comment: s.comment,
      });
      recorded++;
    }

    after(async () => {
      await langfuse.flush();
    });

    return NextResponse.json({ ok: true, recorded });
  } catch (error: any) {
    console.error("Score error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record scores" },
      { status: 500 }
    );
  }
}
