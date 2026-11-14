"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import AuthShell, { ContinueShopping, FormAlert } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const footer = <>Remembered it? <Link href="/login" className="font-semibold text-brand hover:underline">Back to sign in</Link></>;

  if (sent) {
    return (
      <AuthShell
        illustration="mail"
        title="Check your email"
        subtitle={<>If an account uses <strong className="text-foreground">{email}</strong>, a reset link is on its way. It works for 1 hour.</>}
        footer={footer}
      >
        <div className="space-y-2">
          <ContinueShopping />
          <Button variant="outline" onClick={() => setSent(false)} className="h-11 w-full rounded-full font-semibold">
            Try a different email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell illustration="key" title="Forgot your password?" subtitle="No problem. We'll email you a link to choose a new one." tagline="Locked out? We've got you." footer={footer}>
      <form onSubmit={submit} className="space-y-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 rounded-xl pl-10" />
          </div>
        </div>
        <Button type="submit" disabled={sending} className="h-11 w-full rounded-full font-semibold">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send reset link <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>
      </form>
    </AuthShell>
  );
}
