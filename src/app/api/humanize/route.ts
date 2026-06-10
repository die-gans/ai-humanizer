import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

function getGoogleKey(): string {
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  try {
    const hermesEnv = readFileSync(join(homedir(), ".hermes", ".env"), "utf-8");
    const match = hermesEnv.match(/GOOGLE_API_KEY=(.+)/);
    if (match) return match[1].trim();
  } catch { /* ignore */ }
  return "";
}

const genAI = new GoogleGenerativeAI(getGoogleKey());

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

export async function POST(req: NextRequest) {
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

    // Check if we have a valid API key
    const apiKey = getGoogleKey();
    let humanized: string;
    
    if (!apiKey || apiKey.length < 10) {
      // Mock mode: simulate humanization with realistic transformations
      humanized = mockHumanize(text, purpose, tone, intensity);
    } else {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash-latest",
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: Math.min(text.length * 2 + 500, 4000),
          },
        });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nText to rewrite:\n" + text }] }],
        });

        humanized = result.response.text() || text;
      } catch (apiError: any) {
        console.error("API error, falling back to mock:", apiError.message);
        humanized = mockHumanize(text, purpose, tone, intensity);
      }
    }

    return NextResponse.json({
      original: text,
      humanized: humanized.trim(),
      purpose,
      tone,
      intensity,
      wordCount: {
        original: text.split(/\s+/).length,
        humanized: humanized.trim().split(/\s+/).length,
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
