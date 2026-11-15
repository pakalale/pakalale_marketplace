"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { LoginCredentials } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import GoogleButton, { GOOGLE_ERRORS } from "@/components/auth/GoogleButton";
import { destinationAfterLogin, safeNextPath } from "@/lib/authRedirect";

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const googleFinishing = useRef(false);
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>();
  const googleError = params.get("error");
  const visibleError = error || (googleError ? GOOGLE_ERRORS[googleError] || GOOGLE_ERRORS.google_failed : "");

  useEffect(() => {
    if (params.get("google") !== "done" || googleFinishing.current) return;
    googleFinishing.current = true;
    fetch("/api/auth/me")
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok || !result.user) throw new Error("Could not load Google account");
        login(result.user);
        const next = safeNextPath(params.get("next")) || safeNextPath(sessionStorage.getItem("redirectAfterLogin"));
        sessionStorage.removeItem("redirectAfterLogin");
        router.replace(destinationAfterLogin(result.user.role, next));
      })
      .catch(() => {
        googleFinishing.current = false;
        setError(GOOGLE_ERRORS.google_failed);
      });
  }, [login, params, router]);

  const onSubmit = async (data: LoginCredentials) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.code === "EMAIL_NOT_VERIFIED") setUnverifiedEmail(data.email);
        setError(result.error || "Login failed");
        return;
      }

      login(result.user);
      setSuccess("Login successful! Redirecting...");
      const redirectUrl = safeNextPath(params.get("next")) || safeNextPath(sessionStorage.getItem("redirectAfterLogin"));
      sessionStorage.removeItem("redirectAfterLogin");
      router.replace(destinationAfterLogin(result.user.role, redirectUrl));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async () => {
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: unverifiedEmail }),
    }).catch(() => null);
    setResendMessage(response?.ok ? "If this account needs confirmation, a new link is on its way." : "Could not resend the email. Try again shortly.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" aria-label="Pakalale Market home" className="mb-4 inline-flex items-center">
            <Image src="/logo.jpeg" alt="Pakalale Market" className="h-12 w-auto" width={320} height={112} priority />
          </Link>
          <h1 className="text-xl font-bold mt-4">Welcome Back</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to continue
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="mb-4 space-y-3">
              <GoogleButton onError={setError} />
              <p className="text-center text-xs text-muted-foreground">or sign in with email</p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {visibleError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-xs text-destructive">{visibleError}</p>
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-emerald-500 font-medium">✓ {success}</p>
                </div>
              )}
              {unverifiedEmail && (
                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground">Confirm your email before signing in.</p>
                  <button type="button" onClick={resendVerification} className="text-xs font-semibold text-brand hover:underline">
                    Resend confirmation email
                  </button>
                  {resendMessage && <p className="text-xs text-muted-foreground">{resendMessage}</p>}
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10 h-11"
                    autoComplete="email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address",
                      },
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11"
                    autoComplete="current-password"
                    {...register("password", {
                      required: "Password is required",
                      minLength: { value: 6, message: "Must be at least 6 characters" },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-brand hover:text-brand/80 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
