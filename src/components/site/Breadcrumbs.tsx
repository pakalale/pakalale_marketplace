import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * "Home > Account > Orders" trail. Every level except the current page is a
 * link, so people can jump back without the browser's Back button.
 */
export default function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, ...items];
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-[13px] text-muted-foreground [scrollbar-width:none]">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex shrink-0 items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
              {last || !crumb.href ? (
                <span aria-current={last ? "page" : undefined} className={cn(last && "max-w-[16rem] truncate font-semibold text-foreground")}>
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="flex items-center gap-1 hover:text-brand hover:underline">
                  {index === 0 && <Home className="h-3.5 w-3.5" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Breadcrumbs plus a page title, for interior pages outside the account area. */
export function PageHeading({ crumbs, title, children }: { crumbs: Crumb[]; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 space-y-2 sm:mb-6">
      <Breadcrumbs items={crumbs} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-brand sm:text-3xl">{title}</h1>
        {children}
      </div>
    </div>
  );
}
