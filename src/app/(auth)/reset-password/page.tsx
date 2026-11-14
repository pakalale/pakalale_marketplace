"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import AuthShell, { ContinueShopping, FormAlert } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";

const MIN_PASSWORD = 8;

function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const { logout } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(!token);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("Passwords don't match.");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "TOKEN_INVALID") setExpired(true);
        throw new Error(data.error);
      }
      // A reset signs out every device, this one included.
      logout();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not reset your password.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <AuthShell illustration="done" title="Password updated" subtitle="You're signed out everywhere. Sign in with your new password when you're ready." tagline="Fresh start, same market.">
        <div className="space-y-2">
          <ContinueShopping />
          <Button variant="outline" onClick={() => router.push("/login?reset=1")} className="h-11 w-full rounded-full font-semibold">
            Sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (expired) {
    return (
      <AuthShell
        illustration="key"
        title="This link has expired"
        subtitle="Reset links work once and last 1 hour. Ask for a new one and use it soon."
        footer={<Link href="/login" className="font-semibold text-brand hover:underline">Back to sign in</Link>}
      >
        <Button onClick={() => router.push("/forgot-password")} className="h-11 w-full rounded-full font-semibold">
          Get a new link
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell illustration="key" title="Choose a new password" subtitle="You'll use it to sign in from now on." tagline="Fresh start, same market.">
      <form onSubmit={submit} className="space-y-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD} characters`} className="h-11 rounded-xl pl-10 pr-10" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-xl pl-10" />
          </div>
        </div>
        <Button type="submit" disabled={saving} className="h-11 w-full rounded-full font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save new password"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
