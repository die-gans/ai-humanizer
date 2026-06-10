"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2.5 mb-8 group transition-transform hover:scale-105">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.03em]">Humanizer</h1>
      </Link>

      <Card className="w-full max-w-sm bg-card border-border shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold tracking-tight">Create an account</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Enter your email to get started with Humanizer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="text-emerald-400 font-medium">Verification email sent!</div>
              <p className="text-sm text-muted-foreground">
                Please check your inbox to confirm your account.
              </p>
              <Button asChild className="w-full bg-primary hover:bg-primary/90">
                <Link href="/login">Go to Sign In</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background border-border focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background border-border focus:ring-1 focus:ring-primary"
                />
              </div>
              {error && (
                <div className="text-xs font-medium text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign Up"}
              </Button>
            </form>
          )}
          {!success && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign In
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
