"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import AuthShell, { FormAlert } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { destinationAfterLogin, takeReturnPath } from "@/lib/authRedirect";
import { useAuthStore } from "@/store/authStore";

type State = "checking" | "done" | "invalid";

function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuthStore();
  const token = params.get("token");
  const [state, setState] = useState<State>(token ? "checking" : "invalid");
  const [destination, setDestination] = useState("/");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState("");
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single use, so never send the same one twice (e.g. strict-mode remount).
    if (started.current || !token) return;
    started.current = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        login(data.user);
        const to = destinationAfterLogin(data.user.role, params.get("next") ?? takeReturnPath());
        setDestination(to);
        setState("done");
        window.setTimeout(() => router.push(to), 2500);
      })
      .catch(() => setState("invalid"));
  }, [token, params, login, router]);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setResent(res?.ok ? "If that account still needs confirming, a new link is on its way." : "Could not send the email. Try again shortly.");
  };

  if (state === "checking") {
    return (
      <AuthShell illustration="mail" title="Confirming your email" subtitle="Just a moment...">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </AuthShell>
    );
  }

  if (state === "done") {
    return (
      <AuthShell illustration="done" title="You're all set!" subtitle="Your email is confirmed and you're signed in." tagline="Welcome to the market.">
        <Button onClick={() => router.push(destination)} className="h-11 w-full rounded-full font-semibold">
          Continue <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      illustration="mail"
      title="This link has expired"
      subtitle="Confirmation links work once and last 24 hours. Enter your email and we'll send a fresh one."
      footer={<>Already confirmed? <Link href="/login" className="font-semibold text-brand hover:underline">Sign in</Link></>}
    >
      <form onSubmit={resend} className="space-y-3">
        {resent && <FormAlert tone="info">{resent}</FormAlert>}
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 rounded-xl" aria-label="Email" />
        <Button type="submit" className="h-11 w-full rounded-full font-semibold">Send a new link</Button>
      </form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
