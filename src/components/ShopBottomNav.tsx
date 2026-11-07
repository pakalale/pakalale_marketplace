"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Package, ShoppingBag, Store, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 30_000;

export const shopNavItems = [
  { id: "home", label: "Home", icon: Home, href: "/shop/feed" },
  { id: "products", label: "Products", icon: Package, href: "/shop/products" },
  { id: "orders", label: "Orders", icon: ShoppingBag, href: "/shop/orders" },
  { id: "shop", label: "My Shop", icon: Store, href: "/shop/overview" },
  { id: "chat", label: "Chat", icon: MessageSquare, href: "/shop/chat" },
];

export default function ShopBottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const [chatUnread, setChatUnread] = useState(0);
  const [orderCount, setOrderCount] = useState(0);

  // Poll for all counts
  useEffect(() => {
    if (!user?.id) return;

    const fetchCounts = async () => {
      try {
        const [notifRes, chatRes, ordersRes] = await Promise.all([
          fetch(`/api/notifications?userId=${user.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/chat?userId=${user.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/orders?shopId=${user.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (notifRes?.unreadCount !== undefined) setUnreadCount(notifRes.unreadCount);
        if (chatRes) {
          setChatUnread(chatRes.totalUnread || 0);
        }
        if (ordersRes) setOrderCount(ordersRes.orders?.length || 0);
      } catch { /* ignore */ }
    };

    fetchCounts();
    const iv = setInterval(fetchCounts, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchCounts();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user?.id, setUnreadCount]);

  // Real-time updates via socket custom events
  useEffect(() => {
    const handleCountUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.totalUnread !== undefined) {
        setChatUnread(detail.totalUnread);
      }
    };
    const handleIncrement = () => {
      setChatUnread((prev) => prev + 1);
    };
    window.addEventListener("chat-unread-update", handleCountUpdate);
    window.addEventListener("chat-unread-increment", handleIncrement);
    return () => {
      window.removeEventListener("chat-unread-update", handleCountUpdate);
      window.removeEventListener("chat-unread-increment", handleIncrement);
    };
  }, []);

  const getActiveId = () => {
    if (pathname === "/shop/feed") return "home";
    if (pathname.startsWith("/shop/products")) return "products";
    if (pathname.startsWith("/shop/orders")) return "orders";
    if (pathname.startsWith("/shop/overview") || pathname.startsWith("/shop/virtual-shop")) return "shop";
    if (pathname.startsWith("/shop/chat")) return "chat";
    return "home";
  };

  const activeId = getActiveId();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom sm:hidden">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {shopNavItems.map((item) => {
          const isActive = activeId === item.id;
          const badgeCount = item.id === "chat" ? chatUnread : item.id === "orders" ? orderCount : 0;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]",
                isActive
                  ? "text-brand"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <item.icon className={cn("h-5 w-5", isActive && "fill-primary/10")} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-pink-500 text-white text-[9px] rounded-full h-3.5 min-w-[14px] flex items-center justify-center px-0.5 font-bold">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
