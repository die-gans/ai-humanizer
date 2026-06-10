import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Text must be at least 10 characters" },
        { status: 400 }
      );
    }

    // GPTZero API integration
    const gptzeroResponse = await fetch("https://api.gptzero.me/v2/predict/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.GPTZERO_API_KEY || "",
      },
      body: JSON.stringify({
        document: text,
        version: "2024-01-01",
      }),
    });

    let gptzeroResult = null;
    if (gptzeroResponse.ok) {
      gptzeroResult = await gptzeroResponse.json();
    }

    // Fallback: basic heuristic analysis when API fails or no key
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const avgSentenceLength =
      sentences.reduce((acc: number, s: string) => acc + s.split(/\s+/).length, 0) /
      sentences.length;

    // Heuristic: very uniform sentence length suggests AI
    const sentenceLengths = sentences.map((s: string) => s.split(/\s+/).length);
    const variance =
      sentenceLengths.reduce((acc: number, len: number) => {
        const diff = len - avgSentenceLength;
        return acc + diff * diff;
      }, 0) / sentenceLengths.length;
    const stdDev = Math.sqrt(variance);

    // Check for AI patterns
    const aiPatterns = [
      /delve into/gi,
      /leverage/gi,
      /in conclusion/gi,
      /it is important to note/gi,
      /furthermore/gi,
      /moreover/gi,
      /additionally/gi,
      /consequently/gi,
      /therefore/gi,
      /thus/gi,
      /in summary/gi,
      /to summarize/gi,
      /firstly|secondly|thirdly/gi,
    ];

    const patternMatches = aiPatterns.reduce((count: number, pattern: RegExp) => {
      const matches = text.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);

    const patternScore = Math.min(patternMatches / 3, 1) * 30;
    const uniformityScore = stdDev < 3 ? 25 : stdDev < 5 ? 15 : 5;
    const heuristicScore = Math.min(patternScore + uniformityScore, 100);

    return NextResponse.json({
      gptzero: gptzeroResult
        ? {
            confidence: gptzeroResult.documents?.[0]?.confidence,
            averageGeneratedProb: gptzeroResult.documents?.[0]?.average_generated_prob,
            completelyGeneratedProb:
              gptzeroResult.documents?.[0]?.completely_generated_prob,
            overall: gptzeroResult.documents?.[0]?.completely_generated_prob
              ? `${Math.round(
                  gptzeroResult.documents[0].completely_generated_prob * 100
                )}% AI`
              : "Unknown",
          }
        : { error: "GPTZero API not configured", overall: "Unknown" },
      heuristic: {
        aiPatternScore: Math.round(patternScore),
        sentenceUniformityScore: Math.round(uniformityScore),
        overall: `${Math.round(heuristicScore)}% AI (heuristic)`,
        avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
        sentenceStdDev: Math.round(stdDev * 10) / 10,
      },
    });
  } catch (error: any) {
    console.error("Detect error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze text" },
      { status: 500 }
    );
  }
}
