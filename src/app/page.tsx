"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Copy,
  Check,
  Wand2,
  FileText,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

const PURPOSES = [
  { value: "academic", label: "Academic Essay" },
  { value: "blog", label: "Blog Post" },
  { value: "marketing", label: "Marketing Copy" },
  { value: "technical", label: "Technical Doc" },
  { value: "creative", label: "Creative Writing" },
  { value: "casual", label: "Casual / Social" },
];

const TONES = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "simple", label: "Simple" },
  { value: "complex", label: "Complex" },
];

const INTENSITY_LABELS: Record<number, string> = {
  0: "Light",
  1: "Standard",
  2: "Heavy",
};

export default function Home() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [purpose, setPurpose] = useState("blog");
  const [tone, setTone] = useState("casual");
  const [intensity, setIntensity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleHumanize = async () => {
    if (!input.trim() || input.trim().length < 10) {
      setError("Please enter at least 10 characters");
      return;
    }
    setError("");
    setLoading(true);
    setOutput("");
    setDetectionResult(null);

    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          purpose,
          tone,
          intensity: INTENSITY_LABELS[intensity].toLowerCase(),
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setOutput(data.humanized);

      // Auto-run detection on humanized output
      handleDetect(data.humanized);
    } catch (err: any) {
      setError(err.message || "Failed to humanize");
    } finally {
      setLoading(false);
    }
  };

  const handleDetect = async (text: string) => {
    setDetecting(true);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setDetectionResult(data);
    } catch (err: any) {
      console.error("Detection failed:", err);
    } finally {
      setDetecting(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return "bg-green-500";
    if (score < 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const heuristicScore = detectionResult?.heuristic
    ? parseInt(detectionResult.heuristic.overall)
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight">Humanizer POC</h1>
          </div>
          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
            v0.1 — Proof of Concept
          </Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Controls */}
        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Purpose</label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v || "blog")}>
                <SelectTrigger className="bg-zinc-950 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {PURPOSES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Tone</label>
              <Select value={tone} onValueChange={(v) => setTone(v || "casual")}>
                <SelectTrigger className="bg-zinc-950 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">
                Intensity: {INTENSITY_LABELS[intensity]}
              </label>
              <Slider
                value={[intensity]}
                onValueChange={(v: number | readonly number[]) => setIntensity(Array.isArray(v) ? v[0] : v)}
                max={2}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>Light</span>
                <span>Standard</span>
                <span>Heavy</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-900 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Main Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Original Text
              </CardTitle>
              <span className="text-xs text-zinc-600">
                {input.split(/\s+/).filter(Boolean).length} words
              </span>
            </CardHeader>
            <CardContent>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your AI-generated text here..."
                className="min-h-[400px] bg-zinc-950 border-zinc-700 resize-none font-mono text-sm leading-relaxed"
              />
              <Button
                onClick={handleHumanize}
                disabled={loading}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Humanizing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Humanize Text
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Output */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Humanized Result
              </CardTitle>
              <div className="flex items-center gap-2">
                {output && (
                  <span className="text-xs text-zinc-600">
                    {output.split(/\s+/).filter(Boolean).length} words
                  </span>
                )}
                {output && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    className="h-7 px-2 text-zinc-400 hover:text-zinc-100"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {output ? (
                <div className="min-h-[400px] bg-zinc-950 border border-zinc-700 rounded-md p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-auto">
                  {output}
                </div>
              ) : (
                <div className="min-h-[400px] flex items-center justify-center text-zinc-700 text-sm">
                  {loading
                    ? "Transforming your text..."
                    : "Humanized text will appear here"}
                </div>
              )}

              {/* Detection Results */}
              {detectionResult && (
                <div className="mt-4 space-y-3">
                  <Separator className="bg-zinc-800" />
                  <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    AI Detection Analysis
                  </div>

                  {/* GPTZero */}
                  {detectionResult.gptzero?.overall !== "Unknown" ? (
                    <div className="flex items-center justify-between p-2 bg-zinc-950 rounded border border-zinc-800">
                      <span className="text-sm text-zinc-400">GPTZero</span>
                      <Badge
                        className={
                          detectionResult.gptzero.completelyGeneratedProb < 0.3
                            ? "bg-green-600"
                            : detectionResult.gptzero.completelyGeneratedProb < 0.6
                            ? "bg-yellow-600"
                            : "bg-red-600"
                        }
                      >
                        {detectionResult.gptzero.overall}
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 bg-zinc-950 rounded border border-zinc-800">
                      <span className="text-sm text-zinc-400">GPTZero</span>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-500">
                        Not configured
                      </Badge>
                    </div>
                  )}

                  {/* Heuristic */}
                  {heuristicScore !== null && (
                    <div className="p-2 bg-zinc-950 rounded border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-400">
                          Heuristic Score
                        </span>
                        <Badge
                          className={
                            heuristicScore < 30
                              ? "bg-green-600"
                              : heuristicScore < 60
                              ? "bg-yellow-600"
                              : "bg-red-600"
                          }
                        >
                          {detectionResult.heuristic.overall}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>AI Pattern Score</span>
                          <span>{detectionResult.heuristic.aiPatternScore}/30</span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>Sentence Uniformity</span>
                          <span>
                            {detectionResult.heuristic.sentenceUniformityScore}/25
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detecting && !detectionResult && (
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Running detection analysis...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
