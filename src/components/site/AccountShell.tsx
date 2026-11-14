"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import Container from "@/components/landing/Container";
import { ACCOUNT_LINKS, isAccountLinkActive } from "@/lib/siteNav";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import Breadcrumbs, { type Crumb } from "./Breadcrumbs";

/** Home > Account > Orders > Order #ABC123, worked out from the URL. */
function accountCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Account", href: "/customer" }];
  if (pathname === "/customer") return [{ label: "Account" }];
  const section = ACCOUNT_LINKS.find((link) => link.href !== "/customer" && isAccountLinkActive(link.href, pathname));
  if (!section) return crumbs;
  crumbs.push({ label: section.label, href: section.href });
  const rest = pathname.slice(section.href.length).split("/").filter(Boolean);
  if (section.href === "/customer/orders" && rest[0]) {
    crumbs.push({ label: `Order #${rest[0].slice(-6).toUpperCase()}` });
  }
  return crumbs;
}

/**
 * Frame for every account page: a way back to the shop, breadcrumbs, and the
 * account menu (a sidebar on desktop, a scrollable tab bar on phones).
 */
export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const fullHeight = pathname.startsWith("/customer/chat");

  return (
    <Container className="max-w-[1440px] py-4 sm:py-6">
      <div className="mb-4 flex flex-col gap-2 sm:mb-5">
        <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Shop
        </Link>
        <Breadcrumbs items={accountCrumbs(pathname)} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-6">
        <aside className="lg:sticky lg:top-24">
          <div className="hidden rounded-2xl border border-border bg-card p-3 lg:block">
            <div className="flex items-center gap-3 px-2 pb-3 pt-1">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-bold text-brand">
                  {user?.firstName?.[0] ?? "?"}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <nav aria-label="Account" className="space-y-0.5 border-t border-border pt-2">
              {ACCOUNT_LINKS.map((link) => {
                const active = isAccountLinkActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-brand text-white" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <link.icon className={cn("h-4 w-4", active ? "text-primary" : "text-brand")} />
                    {link.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </nav>
          </div>

          {/* Phones: the same menu as a swipeable tab bar. */}
          <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden">
            <div className="flex w-max gap-2 pb-1">
              {ACCOUNT_LINKS.map((link) => {
                const active = isAccountLinkActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                      active ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        <section className={cn("min-w-0", fullHeight && "h-[calc(100dvh-15rem)] min-h-[28rem] lg:h-[calc(100dvh-12rem)]")}>
          {children}
        </section>
      </div>
    </Container>
  );
}
