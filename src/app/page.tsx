"use client";

import { useState, useEffect } from "react";
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
  User,
  LogOut,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [traceId, setTraceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Auth & Profile state
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setAuthLoading(false);
    };

    const fetchProfile = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

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
      setTraceId(data.traceId ?? null);

      // Auto-run detection on humanized output, linked to the humanize trace
      handleDetect(data.humanized, data.traceId ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to humanize");
    } finally {
      setLoading(false);
    }
  };

  const handleDetect = async (text: string, linkedTraceId: string | null) => {
    setDetecting(true);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setDetectionResult(data);

      // Attach detector scores to the humanize trace in Langfuse
      if (linkedTraceId) {
        const scores: { name: string; value: number; comment?: string }[] = [];
        const heur = parseInt(data?.heuristic?.overall);
        if (!Number.isNaN(heur)) {
          scores.push({ name: "heuristic_ai_pct", value: heur, comment: "Built-in heuristic proxy" });
        }
        const gz = data?.gptzero?.overall;
        if (gz && gz !== "Unknown") {
          const gzPct = parseInt(gz);
          if (!Number.isNaN(gzPct)) {
            scores.push({ name: "gptzero_ai_pct", value: gzPct, comment: "GPTZero API" });
          }
        }
        if (scores.length) {
          fetch("/api/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ traceId: linkedTraceId, scores }),
          }).catch((e) => console.error("Score post failed:", e));
        }
      }
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
    <main className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 antialiased">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-[-0.03em]">Humanizer</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase tracking-wider font-medium border-border bg-card text-muted-foreground px-2 py-0">
              v0.1 POC
            </Badge>

            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Words Left</span>
                  <span className="text-sm font-mono font-bold text-primary">
                    {profile?.words_remaining ?? 0}
                  </span>
                </div>
                <div className="h-8 w-[1px] bg-border mx-1 hidden md:block" />
                <div className="flex items-center gap-2 group cursor-pointer relative">
                  <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleLogout}
                    className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild className="text-xs font-semibold">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild className="text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                  <Link href="/signup">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card border-border shadow-none md:col-span-3">
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-2 block uppercase tracking-wider">Purpose</label>
                <Select value={purpose} onValueChange={(v) => setPurpose(v || "blog")}>
                  <SelectTrigger className="bg-background border-border h-9 text-sm focus:ring-1 focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {PURPOSES.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-sm">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-2 block uppercase tracking-wider">Tone</label>
                <Select value={tone} onValueChange={(v) => setTone(v || "casual")}>
                  <SelectTrigger className="bg-background border-border h-9 text-sm focus:ring-1 focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {TONES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-sm">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col justify-center">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Intensity
                  </label>
                  <span className="text-[11px] font-mono text-primary px-1.5 py-0.5 bg-primary/10 rounded">
                    {INTENSITY_LABELS[intensity]}
                  </span>
                </div>
                <Slider
                  value={[intensity]}
                  onValueChange={(v: number | readonly number[]) => setIntensity(Array.isArray(v) ? v[0] : v)}
                  max={2}
                  step={1}
                  className="py-2"
                />
              </div>
            </CardContent>
          </Card>
          
          <div className="flex items-end pb-1">
            <Button
              onClick={handleHumanize}
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-tight shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Humanize
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Main Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                Input Source
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60 bg-secondary px-1.5 py-0.5 rounded">
                {input.split(/\s+/).filter(Boolean).length} WORDS
              </span>
            </div>
            <Card className="bg-card border-border overflow-hidden group focus-within:border-primary/50 transition-colors">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your AI-generated text here..."
                className="min-h-[500px] bg-background border-none resize-none font-sans text-base leading-relaxed p-6 focus-visible:ring-0 placeholder:text-muted-foreground/30"
              />
            </Card>
          </div>

          {/* Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Humanized Output
              </div>
              <div className="flex items-center gap-3">
                {output && (
                  <span className="text-[10px] font-mono text-muted-foreground/60 bg-secondary px-1.5 py-0.5 rounded">
                    {output.split(/\s+/).filter(Boolean).length} WORDS
                  </span>
                )}
                {output && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyToClipboard}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-primary" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <Card className="bg-card border-border overflow-hidden min-h-[500px] flex flex-col">
              <div className="flex-1 p-6 font-sans text-base leading-relaxed whitespace-pre-wrap overflow-auto selection:bg-primary/20">
                {output ? (
                  <div className="animate-in fade-in duration-500">
                    {output}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20 italic text-sm space-y-4">
                    {loading ? (
                      <div className="flex flex-col items-center gap-3 not-italic">
                        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                        <p className="text-muted-foreground/40 animate-pulse">Rebuilding text structure...</p>
                      </div>
                    ) : (
                      <p>Humanized text will appear here</p>
                    )}
                  </div>
                )}
              </div>

              {/* Detection Results Overlay */}
              {detectionResult && (
                <div className="border-t border-border p-6 bg-secondary/30 backdrop-blur-sm animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      AI Probability Score
                    </div>
                    {traceId && (
                      <span className="text-[9px] text-muted-foreground/40 font-mono tracking-tight uppercase">
                        Trace ID: {traceId.slice(0, 12)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* GPTZero */}
                    <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">GPTZero Analysis</span>
                        <span className="text-xs text-muted-foreground/60 font-medium">External API Validation</span>
                      </div>
                      {detectionResult.gptzero?.overall !== "Unknown" ? (
                        <div className="flex flex-col items-end">
                          <span className={`text-xl font-bold tracking-tighter ${
                            detectionResult.gptzero.completelyGeneratedProb < 0.3 ? "text-emerald-400" : 
                            detectionResult.gptzero.completelyGeneratedProb < 0.6 ? "text-amber-400" : "text-rose-400"
                          }`}>
                            {detectionResult.gptzero.overall}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground/40 italic">Not Configured</span>
                      )}
                    </div>

                    {/* Heuristic */}
                    {heuristicScore !== null && (
                      <div className="flex flex-col p-3 bg-background/50 rounded-lg border border-border shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Heuristic Proxy</span>
                            <span className="text-xs text-muted-foreground/60 font-medium">Internal Pattern Check</span>
                          </div>
                          <span className={`text-xl font-bold tracking-tighter ${
                            heuristicScore < 30 ? "text-emerald-400" : 
                            heuristicScore < 60 ? "text-amber-400" : "text-rose-400"
                          }`}>
                            {detectionResult.heuristic.overall}
                          </span>
                        </div>
                        <div className="w-full bg-border h-1 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${
                              heuristicScore < 30 ? "bg-emerald-500" : 
                              heuristicScore < 60 ? "bg-amber-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${heuristicScore}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detecting && !detectionResult && (
                <div className="border-t border-border p-4 bg-secondary/20 flex items-center gap-3 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Scanning for AI Signatures...</span>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
