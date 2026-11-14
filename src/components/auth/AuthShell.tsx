import Image from "next/image";
import Link from "next/link";
import AuthIllustration, { type IllustrationName } from "./AuthIllustration";

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
 * on phones.
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

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" aria-label="Pakalale Market home" className="mb-6 inline-flex lg:hidden">
            <Image src="/logo.jpeg" alt="Pakalale Market" className="h-10 w-auto" width={320} height={112} priority />
          </Link>
          <AuthIllustration name={illustration} className="mb-4 h-24 w-24 lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight text-brand">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
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
