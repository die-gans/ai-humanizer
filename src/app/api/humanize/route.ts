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
import { getHumanizerPrompt, PROMPT_VERSION } from "@/lib/prompts/humanizer";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// OpenTelemetry tracing requires the Node.js runtime (not Edge).
export const runtime = "nodejs";

// ... (keep constants and helper functions)
const GATEWAY_MODEL = process.env.HUMANIZE_MODEL || "google/gemini-2.5-flash";
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
  // ... (keep mock logic)
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
  for (const [full, contraction] of Object.entries(contractions)) {
    result = result.replace(new RegExp(`\\b${full}\\b`, 'gi'), contraction);
  }
  if (tone === 'casual' || purpose === 'casual') {
    const openers = transformations.casual;
    const opener = openers[Math.floor(Math.random() * openers.length)];
    result = opener + result.charAt(0).toLowerCase() + result.slice(1);
  }
  if (intensity === 'heavy' || intensity === 'standard') {
    result = result.replace(/\. ([A-Z])/g, '. $1');
    result = result.replace(/, and /g, '. And ');
    result = result.replace(/, but /g, '. But ');
  }
  if (intensity === 'heavy') {
    result = result.replace(/\b(very|really|quite|pretty)\b/gi, (match) => {
      const fillers = ['really', 'pretty', 'kind of', 'sort of', 'honestly'];
      return fillers[Math.floor(Math.random() * fillers.length)];
    });
  }
  return result;
}

async function humanizeHandler(req: NextRequest) {
  try {
    const {
      text,
      purpose = "blog",
      tone = "casual",
      intensity = "standard",
      model: requestedModel,
    } = await req.json();

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: "Text must be at least 10 characters" }, { status: 400 });
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    
    // Check Auth & Credits
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    
    let profile = null;
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = data;
    }

    // Guest limits: 500 words per day (simulated with a simple char limit for now)
    // Real prod would track IP or use a guest ledger.
    if (!user && wordCount > 500) {
      return NextResponse.json({ error: "Guest limit reached (500 words). Please sign up for more." }, { status: 403 });
    }

    if (user && profile && profile.words_remaining < wordCount) {
      return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan." }, { status: 403 });
    }

    const { prompt: systemPrompt, langfusePrompt } = await getHumanizerPrompt({ purpose, tone, intensity });

    const hasGatewayAuth = !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
    const googleKey = getGoogleKey();

    let model: LanguageModel | undefined;
    let mode: string;
    if (hasGatewayAuth) {
      const slug = typeof requestedModel === "string" && requestedModel ? requestedModel : GATEWAY_MODEL;
      model = slug;
      mode = `gateway:${slug}`;
    } else if (googleKey && googleKey.length >= 10) {
      model = createGoogleGenerativeAI({ apiKey: googleKey })(MODEL_ID);
      mode = `gemini:${MODEL_ID}`;
    } else {
      mode = "mock";
    }

    let humanized: string;
    if (!model) {
      humanized = mockHumanize(text, purpose, tone, intensity);
    } else {
      try {
        const { text: generated } = await generateText({
          model,
          system: systemPrompt,
          prompt: "Text to rewrite:\n" + text,
          temperature: 0.8,
          maxOutputTokens: Math.min(text.length * 2 + 500, 4000),
          experimental_telemetry: {
            isEnabled: true,
            functionId: "humanize",
            metadata: { purpose, tone, intensity, promptVersion: PROMPT_VERSION },
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

    // Deduct credits if user is signed in
    if (user && profile) {
      await supabase
        .from("profiles")
        .update({ words_remaining: profile.words_remaining - wordCount })
        .eq("id", user.id);
    }

    const ioInput = { text, purpose, tone, intensity };
    updateActiveObservation(
      { 
        input: ioInput, 
        output: humanized, 
        prompt: langfusePrompt,
        metadata: { mode, model: MODEL_ID, promptVersion: PROMPT_VERSION } 
      },
      { asType: "span" }
    );
    setActiveTraceIO({ input: ioInput, output: humanized });

    const traceId = getActiveTraceId();
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
      promptVersion: PROMPT_VERSION,
      wordCount: {
        original: wordCount,
        humanized: humanized.split(/\s+/).filter(Boolean).length,
      },
    });
  } catch (error: any) {
    console.error("Humanize error:", error);
    return NextResponse.json({ error: error.message || "Failed to humanize text" }, { status: 500 });
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
