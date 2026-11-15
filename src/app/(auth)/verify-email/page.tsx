"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { destinationAfterLogin, safeNextPath } from "@/lib/authRedirect";

function VerifyEmailForm() {
  const params = useSearchParams();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const token = params.get("token");
  const [email, setEmail] = useState(params.get("email") || "");
  const [status, setStatus] = useState(token ? "checking" : "waiting");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.user) throw new Error(result.error || "This link has expired or was already used.");
        login(result.user);
        const next = safeNextPath(params.get("next")) || safeNextPath(sessionStorage.getItem("redirectAfterLogin"));
        sessionStorage.removeItem("redirectAfterLogin");
        router.replace(destinationAfterLogin(result.user.role, next));
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Could not verify this email.");
        setStatus("waiting");
      });
  }, [login, params, router, token]);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setMessage(response?.ok ? "If the account needs confirmation, a new link is on its way." : "Could not send a new link. Try again shortly.");
    setStatus("waiting");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <section className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <Link href="/" aria-label="Pakalale Market home" className="mb-5 inline-flex">
          <Image src="/logo.jpeg" alt="Pakalale Market" width={320} height={112} className="h-10 w-auto" priority />
        </Link>
        {status === "checking" ? (
          <><Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" /><p className="mt-3 text-sm text-muted-foreground">Confirming your email...</p></>
        ) : (
          <>
            <Mail className="mx-auto h-8 w-8 text-brand" />
            <h1 className="mt-3 text-xl font-bold">Confirm your email</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter the address used to create your account and we&apos;ll send a fresh confirmation link.</p>
            {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
            <form onSubmit={resend} className="mt-5 space-y-3 text-left">
              <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" aria-label="Email address" />
              <Button type="submit" disabled={status === "sending"} className="w-full">
                {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend confirmation email"}
              </Button>
            </form>
            <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">Back to sign in</Link>
          </>
        )}
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailForm /></Suspense>;
}