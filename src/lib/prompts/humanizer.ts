import { langfuse } from "@/lib/langfuse";

/**
 * Humanizer System Prompt Builder
 * Version: 1.0.0 (based on The Humanizer Skill v2.1)
 * 
 * This module implements a curated pattern library built from detector research
 * and feed analysis. It replaces generic "sound human" instructions with 
 * evidence-based rules to remove AI texture.
 */

export const PROMPT_VERSION = "1.0.0";

export interface HumanizerOptions {
  purpose: string;
  tone: string;
  intensity: string;
}

/**
 * Fetches the humanizer prompt from Langfuse with a local fallback.
 */
export async function getHumanizerPrompt(options: HumanizerOptions): Promise<{ prompt: string; langfusePrompt?: any }> {
  try {
    // Attempt to fetch from Langfuse Remote Prompt Management
    const langfusePrompt = await langfuse.prompt.get("humanizer", { label: "production" });
    
    const { purpose, tone, intensity } = options;
    
    // Build the variables the remote template expects
    const variables = {
      purpose_instructions: getPurposeInstructions(purpose),
      tone_instructions: getToneInstructions(tone),
      structural_rules: getStructuralRules(intensity).map(r => `- ${r}`).join("\n"),
      intensity_note: intensity === 'heavy' ? "### INTENSIVE RESTRUCTURING: Feel free to completely rebuild sentence and paragraph structures to break AI-typical patterns while preserving all original facts." : ""
    };

    const compiled = langfusePrompt.compile(variables);
    return { prompt: compiled, langfusePrompt };
  } catch (error) {
    console.error("Failed to fetch prompt from Langfuse, using local fallback:", error);
    return { prompt: buildHumanizerPrompt(options) };
  }
}

function getStructuralRules(intensity: string) {
  const rules = [
    "No em dashes. Rewrite or use commas/periods.",
    "No corporate filler like 'as per our learnings'.",
    "No exaggerated symbolism.",
    "No back-to-back sentences starting with the same first word.",
    "No generic template hooks.",
    "No moralizing tone.",
    "No bullet-point structure where prose would carry more weight.",
    "No intro > 3-point list > conclusion template.",
    "No summary of what was just said at the end.",
    "Vary paragraph length — avoid uniform blocks.",
    "No triple rhetorical question hooks.",
    "No contrast-based negation constructions ('It's not X. It's Y.'). Use positive, declarative statements.",
    "No self-posed questions as transitions ('Why? Because...').",
    "No label-colon frameworks (packaging observations into named 'label: description' pairs)."
  ];
  return intensity === 'light' ? rules.slice(0, 5) : rules;
}

function getPurposeInstructions(purpose: string) {
  const instructions: Record<string, string> = {
    academic: "- Use formal vocabulary and complex sentence structures correctly.\n- Use hedging language ('one might suggest', 'it could be argued') where appropriate.\n- Maintain a scholarly tone but avoid AI-typical 'elevated' filler.",
    blog: "- Use a conversational tone that sounds like a sharp operator.\n- Avoid 'In this article' or 'Let's dive in' meta-commentary.\n- Ensure prose paragraphs vary significantly in length.",
    marketing: "- Use persuasive but grounded language.\n- Avoid hype and 'game-changing' claims.\n- Focus on mechanics, tradeoffs, and clear cause-and-effect.",
    technical: "- Use precise terminology without corporate fluff.\n- Focus on mechanics and how things work.\n- Sound like a senior engineer explaining to a peer.",
    creative: "- Use vivid, concrete imagery instead of abstract AI metaphors.\n- Focus on specific sensory details and firsthand experiences.",
    casual: "- Follow brevity-and-directness rules.\n- Lead with the point or the ask.\n- Match the casual tone of a fast medium like Slack.\n- Avoid formal greetings or sign-offs unless necessary."
  };
  return instructions[purpose] || instructions.blog;
}

function getToneInstructions(tone: string) {
  const instructions: Record<string, string> = {
    formal: "Calm confidence. Pragmatic. Professional but stripped of corporate fluff.",
    casual: "Direct and conversational. Write like you talk to a smart peer.",
    simple: "Clear and direct. Use simple words and short sentences.",
    complex: "Nuanced and analytical. Deep dive into mechanics without using 'delve'."
  };
  return instructions[tone] || instructions.casual;
}

export function buildHumanizerPrompt(options: HumanizerOptions): string {
  const { purpose, tone, intensity } = options;

  const phraseBlocklist = [
    "insights", "the key to", "success requires", "streamline", "leverage", "optimize", 
    "maximize", "unlock", "unlock potential", "unleash", "driving impact", "enable", 
    "empower", "solutions-oriented", "world-class", "cutting-edge", "innovative", 
    "next-gen", "game-changer", "best-in-class", "future-proof", "revolutionary", 
    "scalable", "disruptive", "holistic", "robust", "dynamic", "agile", "seamless", "synergy",
    "delve", "transformative", "harness", "navigate", "landscape", "paradigm", "foster", 
    "cultivate", "facilitate", "utilize", "comprehensive", "albeit", "whilst", "theater", 
    "plainly", "superpower", "journey", "reality", "elevate", "realm", "essentially", "certainly"
  ];

  const clichésBlocklist = [
    "customer-centric", "growth hacking", "data-driven", "actionable insights", 
    "move the needle", "low-hanging fruit", "quick wins", "win-win", "thought leader", 
    "best practices", "at scale", "paradigm shift", "digital transformation", "value-add"
  ];

  const aiPhrases = [
    "brutal clarity", "lost the plot", "painfully clear", "blunt honesty", "that way you can", 
    "with precision", "lived experience", "launching a new chapter", "the energy in the room", 
    "laying the groundwork", "Here's to!", "will never be the same", "that promise becomes reality", 
    "ends the era of", "the same tension", "keeping my hands dirty", "not only...but also", 
    "here's a breakdown", "in the ever-evolving landscape", "a testament to", 
    "there is a specific kind of"
  ];

  const structuralRules = getStructuralRules(intensity);

  return `You are an expert writing assistant calibrated to remove AI-generated texture and rewrite content in an authentic human voice.

### Universal Core Rules:
1. NEVER add new ideas or remove substance. Preserve every argument — only change the delivery.
2. SOUND HUMAN: Write like a sharp operator talking to another operator. Calm. Specific. Grounded.
3. BE SPECIFIC: Use numbers, concrete examples, and clear cause-and-effect. Avoid abstract 'realms' and 'tapestries'.
4. VARY RHYTHM: Mix short, punchy sentences with longer, analytical ones.

### Banned Vocabulary (NEVER USE):
${phraseBlocklist.join(", ")}, ${clichésBlocklist.join(", ")}, ${aiPhrases.join(", ")}

### Structural Rules to Follow:
${structuralRules.map(rule => `- ${rule}`).join("\n")}

### Channel/Purpose Guidance:
${getPurposeInstructions(purpose)}

### Tone Direction:
${getToneInstructions(tone)}

${intensity === 'heavy' ? "### INTENSIVE RESTRUCTURING: Feel free to completely rebuild sentence and paragraph structures to break AI-typical patterns while preserving all original facts." : ""}

Output ONLY the rewritten text. No explanations, no markdown code blocks, no preamble.`;
}
