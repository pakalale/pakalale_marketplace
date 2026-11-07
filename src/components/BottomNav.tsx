"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, MessageSquare, MapPin, Bell, Package } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useCountPolling } from "@/hooks/useCountPolling";
import { useNavScrollVisibility } from "@/hooks/useNavScrollVisibility";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 30_000; // 30 seconds

const navItems = [
  { id: "home", label: "Home", icon: Home, href: "/customer" },
  { id: "shop", label: "Shops", icon: MapPin, href: "/customer/locations" },
  { id: "chat", label: "Chat", icon: MessageSquare, href: "/customer/chat" },
  { id: "orders", label: "Orders", icon: Package, href: "/customer/orders" },
  { id: "alerts", label: "Alerts", icon: Bell, href: "/customer/notifications" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const globalUnreadCount = useNotificationStore((s) => s.unreadCount);
  const [chatUnread, setChatUnread] = useState(0);
  const navVisible = useNavScrollVisibility();

  // Start polling for notification + deal counts
  useCountPolling(user?.id);

  // Initial fetch + periodic polling for chat unread
  useEffect(() => {
    if (!user?.id) return;

    const fetchChatCount = async () => {
      try {
        const res = await fetch(`/api/chat?userId=${user.id}`);
        if (!res.ok) return;
        const d = await res.json();
        setChatUnread(d.totalUnread || 0);
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
  }, [user?.id]);

  // Real-time updates via custom events from global socket
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

  // Determine active tab based on current path
  const getActiveId = () => {
    if (pathname === "/customer") return "home";
    if (pathname.startsWith("/customer/chat")) return "chat";
    if (pathname.startsWith("/customer/locations")) return "locations";
    if (pathname.startsWith("/customer/orders")) return "orders";
    if (pathname.startsWith("/customer/notifications")) return "alerts";
    return "home";
  };

  const activeId = getActiveId();

  return (
    <nav className={cn(
      "fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg safe-area-bottom transition-transform duration-300 sm:hidden",
      navVisible ? "translate-y-0" : "translate-y-full"
    )}>
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeId === item.id;
          const badgeCount = item.id === "alerts" ? globalUnreadCount : item.id === "chat" ? chatUnread : 0;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors",
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
