import Link from "next/link";
import { cn } from "@/lib/utils";

export default function BrandLogo({ className, large }: { className?: string; large?: boolean }) {
  return (
    <Link href="/" aria-label="PakalaleMarket.com home" className={cn("flex min-w-0 items-center gap-2", className)}>
      <svg
        viewBox="0 0 40 44"
        aria-hidden="true"
        className={cn("w-auto shrink-0 text-brand", large ? "h-11" : "h-8 sm:h-10")}
      >
        <path d="M13 15V9.5a7 7 0 0 1 14 0V15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M5.2 13h29.6a2 2 0 0 1 2 1.8L39 40a3.4 3.4 0 0 1-3.4 3.6H4.4A3.4 3.4 0 0 1 1 40l2.2-25.2a2 2 0 0 1 2-1.8Z" fill="#ffb800" />
        <circle cx="13" cy="17" r="1.5" fill="#002583" />
        <circle cx="27" cy="17" r="1.5" fill="#002583" />
      </svg>
      <span className={cn("truncate font-bold tracking-tight text-brand", large ? "text-2xl" : "text-base sm:text-2xl")}>
        PakalaleMarket.com
      </span>
    </Link>
  );
}
