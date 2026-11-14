"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { LoginCredentials } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthShell, { FormAlert } from "@/components/auth/AuthShell";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import { destinationAfterLogin, safeNextPath, takeReturnPath } from "@/lib/authRedirect";

const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in isn't available right now. Please use your email and password.",
  google_cancelled: "Google sign-in was cancelled.",
  google_unverified: "Your Google account's email isn't verified, so we can't use it to sign you in.",
  google_failed: "We couldn't sign you in with Google. Please try again.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [notice, setNotice] = useState("");

  const next = safeNextPath(params.get("next"));
  const googleDone = params.get("google") === "done";
  const finishing = useRef(false);

  // Back from Google with a session cookie: load the account, then carry on.
  useEffect(() => {
    if (!googleDone || finishing.current) return;
    finishing.current = true;
    fetch("/api/auth/me")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.user) throw new Error();
        login(data.user);
        router.replace(destinationAfterLogin(data.user.role, next ?? takeReturnPath()));
      })
      .catch(() => {
        finishing.current = false;
        setError(GOOGLE_ERRORS.google_failed);
        router.replace("/login");
      });
  }, [googleDone, next, login, router]);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>();

  const googleError = GOOGLE_ERRORS[params.get("error") || ""];
  const banner = googleError
    ? { tone: "error" as const, text: googleError }
    : params.get("reset")
    ? { tone: "success" as const, text: "Your password was changed. Sign in with your new password." }
    : params.get("expired")
      ? { tone: "info" as const, text: "Your session ended. Please sign in again to continue." }
      : next
        ? { tone: "info" as const, text: "Sign in to continue. We'll take you right back." }
        : null;

  const onSubmit = async (data: LoginCredentials) => {
    setIsLoading(true);
    setError("");
    setNotice("");
    setUnverifiedEmail("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const result = await res.json();

      if (!res.ok) {
        if (result.code === "EMAIL_NOT_VERIFIED") setUnverifiedEmail(data.email);
        setError(result.error || "Sign in failed");
        return;
      }

      login(result.user);
      // ?next= wins; otherwise a destination saved by a "sign in to continue" button.
      router.push(destinationAfterLogin(result.user.role, next ?? takeReturnPath()));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resend = async () => {
    setNotice("");
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: unverifiedEmail }),
    });
    const result = await res.json().catch(() => ({}));
    setError("");
    setNotice(res.ok ? "We sent a new confirmation link. Check your inbox (and spam folder)." : result.error || "Could not send the email.");
  };

  if (googleDone && !error) {
    return (
      <AuthShell illustration="welcome" title="Signing you in" subtitle="Just a moment...">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      illustration="welcome"
      title="Welcome back"
      subtitle="Sign in to your PakalaleMarket.com account."
      tagline="Good to see you again."
      footer={
        <>
          New here?{" "}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {banner && !error && !notice && <FormAlert tone={banner.tone}>{banner.text}</FormAlert>}
        <GoogleButton next={next} />
        <OrDivider text="or sign in with email" />
        {error && (
          <FormAlert tone="error">
            {error}
            {unverifiedEmail && (
              <button type="button" onClick={resend} className="mt-1 block font-semibold underline">
                Send me a new link
              </button>
            )}
          </FormAlert>
        )}
        {notice && <FormAlert tone="success">{notice}</FormAlert>}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="h-11 rounded-xl pl-10"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email", {
                required: "Email is required",
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
              })}
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="h-11 rounded-xl pl-10 pr-10"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password", { required: "Password is required" })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-full text-sm font-semibold">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign In <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
