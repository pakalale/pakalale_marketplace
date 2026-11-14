"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, LayoutGrid, LogIn, LogOut, MapPin, UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useHydrated } from "@/hooks/useHydrated";
import { ACCOUNT_LINKS, PRIMARY_LINKS, accountHome, isAccountLinkActive } from "@/lib/siteNav";
import { STORE_CATEGORIES, categoryHref } from "@/lib/storeCategories";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const row = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors";
const idle = "text-foreground hover:bg-muted";
const current = "bg-brand/10 font-semibold text-brand";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3">
      <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function ShopLinks({ close }: { close: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <>
      {PRIMARY_LINKS.map((link) => {
        const active = link.isActive(pathname, params);
        return (
          <Link key={link.label} href={link.href} onClick={close} aria-current={active ? "page" : undefined} className={cn(row, active ? current : idle)}>
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

/** Phone navigation: the header's links, categories and account in one drawer. */
export default function MobileMenu({
  open,
  onOpenChange,
  savedHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const signedIn = useHydrated() && isAuthenticated && Boolean(user);
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85%] max-w-sm gap-0 overflow-y-auto p-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <Link href="/" onClick={close} aria-label="PakalaleMarket home">
            <Image src="/logo.jpeg" alt="PakalaleMarket" className="h-9 w-auto" width={320} height={112} />
          </Link>
          <SheetTitle className="sr-only">Menu</SheetTitle>
        </div>

        <nav aria-label="Mobile" className="space-y-3 p-3">
          <div>
            <Suspense>
              <ShopLinks close={close} />
            </Suspense>
          </div>

          <Section title="Categories">
            {STORE_CATEGORIES.map((group) => (
              <Link key={group.label} href={categoryHref(group.label)} onClick={close} className={cn(row, idle)}>
                {group.label}
              </Link>
            ))}
            <Link href="/#products" onClick={close} className={cn(row, idle)}>
              <LayoutGrid className="h-4 w-4 text-brand" /> All products
            </Link>
            <Link href="/customer/locations" onClick={close} className={cn(row, idle)}>
              <MapPin className="h-4 w-4 text-brand" /> Browse by market
            </Link>
          </Section>

          <Section title="Your account">
            {signedIn && user?.role === "customer" ? (
              ACCOUNT_LINKS.map((link) => {
                const active = isAccountLinkActive(link.href, pathname);
                return (
                  <Link key={link.href} href={link.href} onClick={close} aria-current={active ? "page" : undefined} className={cn(row, active ? current : idle)}>
                    <link.icon className="h-4 w-4 text-brand" /> {link.label}
                  </Link>
                );
              })
            ) : signedIn ? (
              <Link href={accountHome(user?.role).href} onClick={close} className={cn(row, idle)}>
                <LayoutGrid className="h-4 w-4 text-brand" /> {accountHome(user?.role).label}
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={close} className={cn(row, idle)}>
                  <LogIn className="h-4 w-4 text-brand" /> Sign in
                </Link>
                <Link href="/signup" onClick={close} className={cn(row, idle)}>
                  <UserPlus className="h-4 w-4 text-brand" /> Create account
                </Link>
                <Link href={savedHref} onClick={close} className={cn(row, idle)}>
                  <Heart className="h-4 w-4 text-brand" /> Saved items
                </Link>
              </>
            )}
            {signedIn && (
              <button
                type="button"
                onClick={() => {
                  close();
                  logout();
                  router.push("/");
                }}
                className={cn(row, "w-full text-destructive hover:bg-destructive/10")}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            )}
          </Section>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
