import { NextRequest, NextResponse, after } from "next/server";
import { generateText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  observe,
  updateActiveObservation,
  setActiveTraceIO,
  getActiveTraceId,
} from "@langfuse/tracing";
import { langfuseSpanProcessor } from "@/lib/langfuse";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// OpenTelemetry tracing requires the Node.js runtime (not Edge).
export const runtime = "nodejs";

// Model routed through Vercel AI Gateway ("provider/model" slug). Override with
// HUMANIZE_MODEL to sweep providers (e.g. openai/gpt-5.4, anthropic/claude-sonnet-4.6)
// in the detector-bypass tuning loop. Confirm slugs via gateway.getAvailableModels().
const GATEWAY_MODEL = process.env.HUMANIZE_MODEL || "google/gemini-2.5-flash";

// Model ID for the direct Google fallback (when no AI Gateway auth is present).
const MODEL_ID = "gemini-2.5-flash";

function getGoogleKey(): string {
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY)
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  try {
    const hermesEnv = readFileSync(join(homedir(), ".hermes", ".env"), "utf-8");
    const match = hermesEnv.match(/GOOGLE_API_KEY=(.+)/);
    if (match) return match[1].trim();
  } catch { /* ignore */ }
  return "";
}

function mockHumanize(text: string, purpose: string, tone: string, intensity: string): string {
  // Realistic mock transformations based on purpose/tone/intensity
  const transformations: Record<string, string[]> = {
    casual: [
      "So, ", "Honestly, ", "Look, ", "I mean, ", "Yeah, ", "Basically, ", "Right, ",
    ],
    formal: [
      "It is worth noting that ", "Furthermore, ", "Consequently, ", "In light of this, ",
    ],
  };
  
  const contractions: Record<string, string> = {
    "do not": "don't", "does not": "doesn't", "did not": "didn't",
    "will not": "won't", "cannot": "can't", "is not": "isn't",
    "are not": "aren't", "was not": "wasn't", "were not": "weren't",
    "have not": "haven't", "has not": "hasn't", "had not": "hadn't",
    "would not": "wouldn't", "could not": "couldn't", "should not": "shouldn't",
    "it is": "it's", "that is": "that's", "there is": "there's",
    "they are": "they're", "you are": "you're", "we are": "we're",
    "I am": "I'm", "I will": "I'll", "I have": "I've",
  };
  
  let result = text;
  
  // Apply contractions
  for (const [full, contraction] of Object.entries(contractions)) {
    result = result.replace(new RegExp(`\\b${full}\\b`, 'gi'), contraction);
  }
  
  // Add casual opener for casual tone
  if (tone === 'casual' || purpose === 'casual') {
    const openers = transformations.casual;
    const opener = openers[Math.floor(Math.random() * openers.length)];
    result = opener + result.charAt(0).toLowerCase() + result.slice(1);
  }
  
  // Vary sentence structure - break some sentences
  if (intensity === 'heavy' || intensity === 'standard') {
    result = result.replace(/\. ([A-Z])/g, '. $1');
    // Add some sentence fragments
    result = result.replace(/, and /g, '. And ');
    result = result.replace(/, but /g, '. But ');
  }
  
  // Add filler words for heavy intensity
  if (intensity === 'heavy') {
    result = result.replace(/\b(very|really|quite|pretty)\b/gi, (match) => {
      const fillers = ['really', 'pretty', 'kind of', 'sort of', 'honestly'];
      return fillers[Math.floor(Math.random() * fillers.length)];
    });
  }
  
  return result;
}

const PURPOSE_PROMPTS: Record<string, string> = {
  academic:
    "Rewrite this as a polished academic essay. Use formal vocabulary, complex sentence structures, hedging language ('it could be argued that', 'one might suggest'), and appropriate academic transitions. Maintain scholarly tone.",
  blog: "Rewrite this as a casual, engaging blog post. Use conversational tone, personal anecdotes framing, rhetorical questions, and varied sentence lengths. Make it feel like a real person wrote it for Medium or Substack.",
  marketing:
    "Rewrite this as punchy marketing copy. Use persuasive language, power words, short punchy sentences mixed with longer ones, and a compelling rhythm. Keep it human and authentic, not spammy.",
  technical:
    "Rewrite this as clear technical documentation. Use precise terminology, logical flow, practical examples, and a knowledgeable but accessible tone. Like a senior engineer explaining to a junior.",
  creative:
    "Rewrite this as creative prose. Use vivid imagery, metaphor, varied rhythm, and a distinctive voice. Make it feel like fiction or literary nonfiction.",
  casual:
    "Rewrite this as casual everyday writing. Use contractions, informal phrasing, occasional sentence fragments, and a relaxed friendly tone. Like a text to a friend.",
};

const TONE_ADJUSTMENTS: Record<string, string> = {
  formal: "Use formal vocabulary, avoid contractions, maintain distance.",
  casual: "Use contractions, slang where appropriate, warm and approachable.",
  simple: "Use simple words, short sentences, clear and direct.",
  complex: "Use sophisticated vocabulary, complex sentence structures, nuanced expression.",
};

async function humanizeHandler(req: NextRequest) {
  try {
    const { text, purpose = "blog", tone = "casual", intensity = "standard" } =
      await req.json();

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Text must be at least 10 characters" },
        { status: 400 }
      );
    }

    const purposePrompt = PURPOSE_PROMPTS[purpose] || PURPOSE_PROMPTS.blog;
    const tonePrompt = TONE_ADJUSTMENTS[tone] || TONE_ADJUSTMENTS.casual;

    const intensityModifiers: Record<string, string> = {
      light: "Make minimal changes. Preserve as much original structure as possible while just smoothing out obvious AI patterns.",
      standard:
        "Make moderate changes. Restructure sentences, vary vocabulary, and adjust flow while keeping the core meaning intact.",
      heavy: "Make significant changes. Completely restructure paragraphs, vary sentence patterns dramatically, and transform the writing style while preserving all key information.",
    };

    const intensityPrompt =
      intensityModifiers[intensity] || intensityModifiers.standard;

    const systemPrompt = `You are an expert writing assistant that transforms AI-generated text into natural, human-like prose. Your job is to make text read as if written by a real person — with natural rhythm, varied sentence structure, occasional imperfections, and authentic voice.

Key rules:
- NEVER add new information not in the original
- NEVER remove key facts or arguments
- Vary sentence length dramatically (short punchy sentences mixed with longer, flowing ones)
- Use contractions naturally (don't, can't, won't, I'm, it's)
- Occasionally start sentences with conjunctions (But, And, So, Yet)
- Use idiomatic expressions and colloquialisms where appropriate
- Include occasional sentence fragments for rhythm
- Avoid repetitive sentence structures
- Avoid lists of three unless absolutely necessary
- Don't use phrases like "delve into", "leverage", "in conclusion", "it's important to note"
- Make transitions feel organic, not formulaic
- Introduce subtle human touches: slight redundancy, parenthetical asides, rhetorical questions

${purposePrompt}

Tone direction: ${tonePrompt}

Intensity: ${intensityPrompt}

Output ONLY the rewritten text. No explanations, no markdown code blocks, no preamble.`;

    // Resolve which model to call. Prefer AI Gateway (multi-provider, one auth —
    // ideal for sweeping models in the tuning loop); fall back to a direct Google
    // key so the free local path still works; else mock.
    const hasGatewayAuth = !!(
      process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
    );
    const googleKey = getGoogleKey();

    let model: LanguageModel | undefined;
    let mode: string;
    if (hasGatewayAuth) {
      model = GATEWAY_MODEL; // plain "provider/model" string routes through AI Gateway
      mode = `gateway:${GATEWAY_MODEL}`;
    } else if (googleKey && googleKey.length >= 10) {
      model = createGoogleGenerativeAI({ apiKey: googleKey })(MODEL_ID);
      mode = `gemini:${MODEL_ID}`;
    } else {
      mode = "mock";
    }

    let humanized: string;
    if (!model) {
      // Mock mode: simulate humanization with realistic transformations
      humanized = mockHumanize(text, purpose, tone, intensity);
    } else {
      try {
        const { text: generated } = await generateText({
          model,
          system: systemPrompt,
          prompt: "Text to rewrite:\n" + text,
          temperature: 0.8,
          maxOutputTokens: Math.min(text.length * 2 + 500, 4000),
          // Emits OpenTelemetry spans (model, tokens, latency) captured by Langfuse.
          experimental_telemetry: {
            isEnabled: true,
            functionId: "humanize",
            metadata: { purpose, tone, intensity },
          },
        });

        humanized = generated?.trim() || text;
      } catch (apiError: any) {
        console.error("Model error, falling back to mock:", apiError.message);
        humanized = mockHumanize(text, purpose, tone, intensity);
        mode = "mock-fallback";
      }
    }

    humanized = humanized.trim();

    // Record meaningful input/output on the root observation (not raw request
    // args), and promote the same to the trace level for the traces list view.
    const ioInput = { text, purpose, tone, intensity };
    updateActiveObservation(
      { input: ioInput, output: humanized, metadata: { mode, model: MODEL_ID } },
      { asType: "span" }
    );
    setActiveTraceIO({ input: ioInput, output: humanized });

    // Returned so the client / eval harness can attach detector scores to this trace.
    const traceId = getActiveTraceId();

    // Ensure spans are exported before the serverless function freezes.
    after(async () => {
      await langfuseSpanProcessor.forceFlush();
    });

    return NextResponse.json({
      original: text,
      humanized,
      traceId,
      mode,
      purpose,
      tone,
      intensity,
      wordCount: {
        original: text.split(/\s+/).length,
        humanized: humanized.split(/\s+/).length,
      },
    });
  } catch (error: any) {
    console.error("Humanize error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to humanize text" },
      { status: 500 }
    );
  }
}

// Wrapping with `observe` creates the root "humanize" observation/trace; the
// AI SDK's telemetry spans (model, tokens, latency) nest under it. We disable
// auto-capture so our explicit input/output (not the NextResponse) is kept.
export const POST = observe(humanizeHandler, {
  name: "humanize",
  captureInput: false,
  captureOutput: false,
});
