"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store, Bell, Home, MapPin, MessageSquare, Settings, Menu, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import AnimatedSearch from "./AnimatedSearch";
import SearchOverlay from "./SearchOverlay";
import { useDealStore } from "@/store/dealStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useCountPolling } from "@/hooks/useCountPolling";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 30_000;

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  userId?: string;
  title?: string;
}

export default function Header({ activeTab = "home", onTabChange, userId, title }: HeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const dealCount = useDealStore((s) => s.dealCount);
  const setDealCount = useDealStore((s) => s.setDealCount);
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
        setDealCount(d.totalDeals || 0);
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
  }, [userId, setUnreadCount, setDealCount]);

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
    { id: "store", label: "Store", icon: Store, href: "/" },
    { id: "locations", label: "Shops", icon: MapPin, href: "/customer/locations" },
    { id: "deals", label: "Deals", icon: ShoppingBag, href: "/customer/deals", count: dealCount },
    { id: "chat", label: "Chat", icon: MessageSquare, href: "/customer/chat", count: chatUnreadCount },
    { id: "notifications", label: "Alerts", icon: Bell, href: "/customer/notifications", count: unreadCount },
  ];

  return (
    <>
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-14 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-primary p-1.5 rounded-lg"><Store className="h-4 w-4 text-primary-foreground" /></div>
          <span className="text-lg font-bold hidden sm:inline">Pakalale</span>
        </div>

        {title ? (
          <h1 className="text-sm font-bold flex-1 text-center">{title}</h1>
        ) : (
          <div className="flex-1 min-w-0 flex justify-center"><div className="w-full max-w-md"><AnimatedSearch onClick={() => setSearchOpen(true)} /></div></div>
        )}

        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="sm:hidden shrink-0" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0">
            <SheetTitle className="px-4 py-4 border-b border-border text-left">Menu</SheetTitle>
            <nav className="p-4 space-y-1">
              {navItems.map((item) => (
                <button key={item.id} onClick={() => { router.push(item.href); setOpen(false); }}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === item.id ? "bg-primary/10 text-brand" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {!!item.count && <Badge className="bg-pink-500 text-white h-5 min-w-[20px] text-[10px] border-0 font-bold rounded-full">{item.count > 9 ? "9+" : item.count}</Badge>}
                </button>
              ))}
              <div className="border-t border-border my-3" />
              <button onClick={() => { router.push("/customer/settings"); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Settings className="h-5 w-5" /><span className="flex-1 text-left">Settings</span>
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop nav */}
      <div className="hidden sm:flex items-center justify-center gap-1 px-4 pb-2">
        {navItems.map((item) => (
          <Link key={item.id} href={item.href} prefetch={true}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative", activeTab === item.id ? "bg-primary/10 text-brand" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {!!item.count && (
              <span className="ml-1 bg-pink-500 text-white text-[9px] rounded-full h-3.5 min-w-[14px] flex items-center justify-center px-0.5 font-bold">{item.count > 9 ? "9+" : item.count}</span>
            )}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <Link href="/customer/settings" prefetch={true}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", activeTab === "settings" ? "bg-primary/10 text-brand" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
          Settings
        </Link>
      </div>
    </header>

    {/* Search Overlay */}
    <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
