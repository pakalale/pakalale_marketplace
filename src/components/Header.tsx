"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Home, MapPin, MessageSquare, Settings, Menu, ShoppingCart, Package, Heart, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AnimatedSearch from "./AnimatedSearch";
import SearchOverlay from "./SearchOverlay";
import { useNotificationStore } from "@/store/notificationStore";
import { useCountPolling } from "@/hooks/useCountPolling";
import { useHydrated } from "@/hooks/useHydrated";
import { cartItemCount, useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useAuthStore } from "@/store/authStore";
import { useNavScrollVisibility } from "@/hooks/useNavScrollVisibility";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 30_000;

interface HeaderProps {
  activeTab?: string;
  userId?: string;
  title?: string;
}

export default function Header({ activeTab = "home", userId, title }: HeaderProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const cartItems = useCartStore((state) => state.items);
  const savedCount = useWishlistStore((state) => state.items.length);
  const navVisible = useNavScrollVisibility();
  const mounted = useHydrated();
  const cartCount = mounted ? cartItemCount(cartItems) : 0;
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  // Start polling for notification + deal counts
  useCountPolling(userId);

  // Initial fetch + periodic polling for chat unread
  useEffect(() => {
    if (!userId) return;

    const fetchChatCount = async () => {
      try {
        const res = await fetch(`/api/chat?userId=${userId}`);
        if (!res.ok) return;
        const d = await res.json();
        setChatUnreadCount(d.totalUnread || 0);
      } catch { /* ignore */ }
    };

    fetchChatCount();
    const iv = setInterval(fetchChatCount, POLL_INTERVAL);

    // Refetch when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchChatCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId, setUnreadCount]);

  // Real-time chat unread updates via global socket events
  useEffect(() => {
    const handleCountUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.totalUnread !== undefined) {
        setChatUnreadCount(detail.totalUnread);
      }
    };
    const handleIncrement = () => {
      setChatUnreadCount((prev) => prev + 1);
    };
    window.addEventListener("chat-unread-update", handleCountUpdate);
    window.addEventListener("chat-unread-increment", handleIncrement);
    return () => {
      window.removeEventListener("chat-unread-update", handleCountUpdate);
      window.removeEventListener("chat-unread-increment", handleIncrement);
    };
  }, []);

  const navItems = [
    { id: "home", label: "Home", icon: Home, href: "/customer" },
    { id: "locations", label: "Shops", icon: MapPin, href: "/customer/locations" },
    { id: "chat", label: "Chat", icon: MessageSquare, href: "/customer/chat", count: chatUnreadCount },
    { id: "notifications", label: "Alerts", icon: Bell, href: "/customer/notifications", count: unreadCount },
    { id: "orders", label: "Orders", icon: Package, href: "/customer/orders" },
    { id: "settings", label: "Settings", icon: Settings, href: "/customer/settings" },
  ];
  const mobileNavItems = [
    navItems[0],
    navItems[1],
    { id: "cart", label: "Cart", icon: ShoppingCart, href: "/customer/cart", count: cartCount },
    { id: "saved", label: "Saved items", icon: Heart, href: "/customer/saved", count: savedCount },
    ...navItems.slice(2),
  ];

  return (
    <>
    <header className={cn(
      "sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-lg transition-transform duration-300",
      navVisible ? "translate-y-0" : "-translate-y-full"
    )}>
      {/* Top bar */}
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open navigation menu" className="shrink-0 sm:hidden" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-80 max-w-[88vw] gap-0 overflow-hidden p-0 duration-300 ease-out">
            <SheetTitle className="flex items-center border-b border-border px-4 py-4 pr-12 text-left">
              <Link href="/customer" onClick={() => setOpen(false)} aria-label="Pakalale home" className="flex items-center gap-2">
                <Image src="/logo.jpeg" alt="Pakalale Market" width={320} height={112} className="h-8 w-auto" priority />
              </Link>
            </SheetTitle>

            <Link
              href={user?.id ? `/customer/profile/${user.id}` : "/customer/settings"}
              onClick={() => setOpen(false)}
              className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 transition-colors hover:bg-muted"
            >
              <Avatar className="h-11 w-11">
                <AvatarImage src={user?.avatar} alt="" />
                <AvatarFallback className="bg-primary/10 text-brand">
                  {user?.firstName?.[0] || <UserRound className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{user ? `${user.firstName} ${user.lastName}` : "Your profile"}</span>
                <span className="block truncate text-xs text-muted-foreground">{user?.email || "Account settings"}</span>
              </span>
              <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>

            <nav aria-label="Customer menu" className="flex-1 space-y-1 overflow-y-auto p-3">
              {mobileNavItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={activeTab === item.id ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    activeTab === item.id ? "bg-primary/10 text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {!!item.count && (
                    <Badge className="h-5 min-w-5 rounded-full border-0 bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {item.count > 99 ? "99+" : item.count}
                    </Badge>
                  )}
                </Link>
              ))}
            </nav>
            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Pakalale Market</div>
          </SheetContent>
        </Sheet>

        {title ? (
          <h1 className="text-sm font-bold flex-1 text-center">{title}</h1>
        ) : (
          <div className="flex min-w-0 flex-1 justify-center">
            <div className="w-full max-w-xl">
              <AnimatedSearch onClick={() => setSearchOpen(true)} />
            </div>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2 sm:gap-2 sm:pl-3">
          <button
            type="button"
            onClick={() => router.push("/customer/saved")}
            aria-label={`Saved items${mounted && savedCount ? `, ${savedCount} saved` : ""}`}
            aria-current={activeTab === "wishlist" ? "page" : undefined}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Heart className="h-5 w-5" />
            {mounted && savedCount > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {savedCount > 99 ? "99+" : savedCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push("/customer/cart")}
            aria-label={`Cart${mounted && cartCount ? `, ${cartCount} items` : ""}`}
            aria-current={activeTab === "cart" ? "page" : undefined}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ShoppingCart className="h-5 w-5" />
            {mounted && cartCount > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </div>

      </div>

      {/* Desktop nav */}
      <nav aria-label="Customer navigation" className="hidden border-t border-border/70 bg-muted/20 sm:flex">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-2">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              prefetch
              aria-current={activeTab === item.id ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-card text-brand shadow-sm"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {!!item.count && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {item.count > 99 ? "99+" : item.count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </header>

    {/* Search Overlay */}
    <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
