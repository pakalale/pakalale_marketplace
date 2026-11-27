"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ExternalLink,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { cartItemCount, useCartStore } from "@/store/cartStore";
import { useHydrated } from "@/hooks/useHydrated";

type BadgeKind = "unread" | "cart";

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Extra routes that should highlight this item (e.g. the storefront preview). */
  also?: string[];
  badge?: BadgeKind;
}

const customerItems: SidebarItem[] = [
  { href: "/customer", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/customer/locations", label: "Shops", icon: MapPin },
  { href: "/customer/search", label: "Search", icon: Search },
  { href: "/customer/chat", label: "Messages", icon: MessageSquare },
  { href: "/customer/orders", label: "Orders", icon: Package },
  { href: "/customer/cart", label: "Cart", icon: ShoppingCart, badge: "cart" },
  { href: "/customer/saved", label: "Saved items", icon: Heart },
];

const customerAccount: SidebarItem[] = [
  { href: "/customer/notifications", label: "Notifications", icon: Bell, badge: "unread" },
  { href: "/customer/settings", label: "Settings", icon: Settings },
];

const shopItems: SidebarItem[] = [
  { href: "/shop/feed", label: "Home", icon: LayoutDashboard },
  { href: "/shop/products", label: "Products", icon: Package },
  { href: "/shop/orders", label: "Orders", icon: ShoppingBag },
  { href: "/shop/overview", label: "My Shop", icon: Store, also: ["/shop/virtual-shop", "/shop/sales", "/shop/analytics", "/shop/smart-products"] },
  { href: "/shop/chat", label: "Messages", icon: MessageSquare },
];

const shopAccount: SidebarItem[] = [
  { href: "/shop/notifications", label: "Notifications", icon: Bell, badge: "unread" },
  { href: "/shop/settings", label: "Settings", icon: Settings },
];

export default function AccountSidebar({ variant }: { variant: "shop" | "customer" }) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useHydrated();
  const { user, logout } = useAuthStore();
  const unread = useNotificationStore((state) => state.unreadCount);
  const cartCount = useCartStore((state) => cartItemCount(state.items));

  const isShop = variant === "shop";
  const primary = isShop ? shopItems : customerItems;
  const secondary = isShop ? shopAccount : customerAccount;
  const profileHref = isShop ? "/shop/settings" : "/customer/settings";

  const isActive = (item: SidebarItem) => {
    if (item.exact) return pathname === item.href;
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
    return (item.also ?? []).some(
      (href) => pathname === href || pathname.startsWith(`${href}/`)
    );
  };

  const badgeCount = (badge?: BadgeKind) => {
    if (!mounted || !badge) return 0;
    return badge === "cart" ? cartCount : unread;
  };

  const renderItem = (item: SidebarItem) => {
    const active = isActive(item);
    const count = badgeCount(item.badge);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-brand text-brand-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <item.icon
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            active ? "text-brand-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {count > 0 && (
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
              active ? "bg-brand-foreground/20 text-brand-foreground" : "bg-pink-500 text-white"
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <Image
          src="/logo.png"
          alt="Pakalale Market"
          width={320}
          height={112}
          priority
          className="h-8 w-auto"
        />
      </div>

      <div className="shrink-0 px-4 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isShop ? "Shop account" : "My account"}
        </p>
      </div>

      <nav
        aria-label={isShop ? "Shop account navigation" : "Customer account navigation"}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
      >
        {primary.map(renderItem)}
        <div className="my-3 border-t border-border" />
        {secondary.map(renderItem)}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        {/* Shops work from their own storefront, so browsing the marketplace is a customer action. */}
        {!isShop && (
          <Link
            href="/"
            className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-brand transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Browse the store
          </Link>
        )}

        <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-2">
          <Link href={profileHref} aria-label="Account settings" className="shrink-0">
            {user?.avatar ? (
              <Image
                src={user.avatar}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                {user?.firstName?.[0] ?? "?"}
              </span>
            )}
          </Link>
          <Link href={profileHref} className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">
              {user ? `${user.firstName} ${user.lastName}` : "Your account"}
            </span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {user?.email || "Account settings"}
            </span>
          </Link>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
