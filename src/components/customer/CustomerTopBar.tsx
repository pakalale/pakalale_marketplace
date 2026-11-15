"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Heart, LayoutDashboard, LogOut, MessageSquare, Package, ShoppingCart, Store } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { cartItemCount, useCartStore } from "@/store/cartStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/customer", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/customer/orders", label: "Orders", icon: Package },
  { href: "/customer/cart", label: "Cart", icon: ShoppingCart },
  { href: "/customer/chat", label: "Messages", icon: MessageSquare },
  { href: "/customer/saved", label: "Saved", icon: Heart },
];

const ICON_BUTTON = "relative flex h-9 w-9 items-center justify-center rounded-lg text-brand transition-colors hover:bg-muted";

/**
 * Header for a signed-in buyer's account. The public store header belongs to
 * browsing; once someone is in their account they get this instead.
 */
export default function CustomerTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useHydrated();
  const { user, logout } = useAuthStore();
  const cartCount = useCartStore((state) => cartItemCount(state.items));
  const unread = useNotificationStore((state) => state.unreadCount);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4">
        <Link href="/customer" aria-label="My account" className="flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt="Pakalale Market" className="h-8 w-auto" width={320} height={112} priority />
          <span className="hidden text-sm font-bold text-brand sm:inline">My account</span>
        </Link>

        <nav aria-label="Account sections" className="ml-3 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href, link.exact) ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(link.href, link.exact)
                  ? "bg-brand/10 text-brand"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-0.5">
          <Link href="/" className="mr-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-muted">
            <Store className="h-4 w-4" /> <span className="hidden lg:inline">Store</span>
          </Link>

          <Link href="/cart" aria-label={`Cart, ${mounted ? cartCount : 0} items`} className={ICON_BUTTON}>
            <ShoppingCart className="h-[18px] w-[18px]" />
            {mounted && cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>

          <Link href="/customer/notifications" aria-label="Notifications" className={ICON_BUTTON}>
            <Bell className="h-[18px] w-[18px]" />
            {mounted && unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          {mounted && user && (
            <Link href="/customer/profile" aria-label="My profile" className="ml-0.5 flex h-9 w-9 items-center justify-center">
              {user.avatar ? (
                <Image src={user.avatar} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" style={{ borderRadius: "9999px" }} />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                  {user.firstName?.[0] ?? "?"}
                </span>
              )}
            </Link>
          )}

          <button
            type="button"
            aria-label="Sign out"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
