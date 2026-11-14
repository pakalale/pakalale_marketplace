"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { lastSitePage } from "@/lib/authRedirect";
import AuthIllustration, { type IllustrationName } from "./AuthIllustration";

/** Primary way back to the store from confirmation screens. */
export function ContinueShopping({ variant = "primary" }: { variant?: "primary" | "outline" }) {
  return (
    <Link
      href="/"
      className={
        variant === "primary"
          ? "flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          : "flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-border text-sm font-semibold text-brand hover:bg-muted"
      }
    >
      Continue Shopping <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/**
 * Returns to the page the person was on before they started signing in,
 * skipping any sign-in pages in between (e.g. login -> signup -> back).
 */
function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(lastSitePage() ?? "/")}
      className={className}
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );
}

interface AuthShellProps {
  illustration: IllustrationName;
  title: string;
  subtitle?: React.ReactNode;
  /** Words on the brand panel (large screens only). */
  tagline?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Shared frame for sign-in, sign-up and email pages: a brand panel with an
 * illustration on large screens, and a compact illustration above the form
 * on phones. These pages stand alone: no site header or footer, just Back.
 */
export default function AuthShell({
  illustration,
  title,
  subtitle,
  tagline = "Shop Smart. Live Better.",
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-[#002583] p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ffb800]/15" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/5" />
        <Link href="/" className="relative text-lg font-bold tracking-tight">
          PakalaleMarket<span className="text-[#ffb800]">.com</span>
        </Link>
        <div className="relative">
          <AuthIllustration name={illustration} className="mx-auto w-full max-w-xs" />
          <p className="mt-8 text-3xl font-bold leading-tight">{tagline}</p>
          <p className="mt-3 max-w-sm text-white/75">
            Trusted local shops across Zambia, in one place.
          </p>
        </div>
        <p className="relative text-xs text-white/60">&copy; {new Date().getFullYear()} PakalaleMarket.com</p>
      </aside>

      <main className="flex flex-1 flex-col px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center justify-between">
          <BackButton className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand transition-colors hover:bg-muted -ml-3" />
          <Link href="/" aria-label="PakalaleMarket home" className="lg:hidden">
            <Image src="/logo.jpeg" alt="PakalaleMarket" className="h-10 w-auto" width={320} height={112} priority />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-6">
          <div className="w-full max-w-sm">
            <AuthIllustration name={illustration} className="mb-4 h-24 w-24 lg:hidden" />
            <h1 className="text-2xl font-bold tracking-tight text-brand">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-destructive/25 bg-destructive/10 text-destructive",
    success: "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
    info: "border-brand/20 bg-brand/5 text-brand",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
