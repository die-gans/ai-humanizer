"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Loader2, ShieldCheck, SlidersHorizontal, Eye } from "lucide-react";

const SEGMENTS = [
  { value: "student", label: "Student" },
  { value: "marketer", label: "Content marketer" },
  { value: "freelancer", label: "Freelance writer" },
  { value: "non-native", label: "Non-native speaker" },
  { value: "developer", label: "Developer / API" },
  { value: "other", label: "Something else" },
];

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, segment, source: "waitlist-landing" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setState("done");
    } catch (err: any) {
      setError(err.message);
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="max-w-3xl mx-auto px-6 py-20 flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="w-6 h-6 text-emerald-400" />
          <span className="text-lg font-bold tracking-tight">AI Humanizer</span>
          <Badge variant="outline" className="ml-2 text-xs border-zinc-700 text-zinc-400">
            Early access
          </Badge>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          The AI humanizer that{" "}
          <span className="text-emerald-400">actually works</span>.
        </h1>
        <p className="mt-5 text-lg text-zinc-400 max-w-2xl">
          14 of 16 humanizers fail modern detectors and ship broken English. We publish our
          real detector bypass rates every month — no fake screenshots, no &ldquo;100%
          guaranteed&rdquo; lies. Just text that reads human and survives the test.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {[
            { icon: ShieldCheck, title: "Works", body: "Real bypass rates, published monthly." },
            { icon: SlidersHorizontal, title: "Controls", body: "Purpose, tone, intensity — not one-size-fits-all." },
            { icon: Eye, title: "Transparent", body: "See what changed and why. We admit failures." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <f.icon className="w-5 h-5 text-emerald-400 mb-2" />
              <div className="font-semibold text-sm">{f.title}</div>
              <div className="text-xs text-zinc-500 mt-1">{f.body}</div>
            </div>
          ))}
        </div>

        {state === "done" ? (
          <div className="mt-10 flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-300">
            <Check className="w-5 h-5" />
            You&apos;re on the list. We&apos;ll email you when the first benchmark drops.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
              <Button
                type="submit"
                disabled={state === "loading"}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Joining...
                  </>
                ) : (
                  "Get early access"
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setSegment(s.value)}
                  className={`text-xs rounded-full border px-3 py-1 transition-colors ${
                    segment === s.value
                      ? "border-emerald-600 bg-emerald-950/50 text-emerald-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <p className="text-xs text-zinc-600">
              We don&apos;t train on your text and we don&apos;t sell your email. That&apos;s the deal.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
