"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Store, Heart, MapPin, Package, Info, Bell, Trash2, Sparkles, TrendingUp, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useNotifications, markNotificationsRead, type NotificationData } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";
import { useNotificationStore } from "@/store/notificationStore";

const iconMap: Record<string, React.ElementType> = {
  deal: MessageSquare,
  message: MessageSquare,
  shop: Store,
  review: Heart,
  order: Package,
  system: Info,
};
const colorMap: Record<string, string> = {
  deal: "text-brand bg-primary/10",
  message: "text-teal-500 bg-teal-500/10",
  shop: "text-amber-400 bg-amber-400/10",
  review: "text-rose-400 bg-rose-400/10",
  order: "text-blue-400 bg-blue-400/10",
  system: "text-muted-foreground bg-muted",
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, loading, refetch } = useNotifications(user?.id || null);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const notifications = data?.notifications || [];

  // Sync unread count to global store
  useEffect(() => {
    if (data?.unreadCount !== undefined) {
      setUnreadCount(data.unreadCount);
    }
  }, [data?.unreadCount, setUnreadCount]);

  // Mark all as read on visit
  useEffect(() => {
    if (user?.id && data?.unreadCount && data.unreadCount > 0) {
      markNotificationsRead(user.id).then(() => {
        refetch();
        setUnreadCount(0);
      });
    }
  }, [user?.id, data?.unreadCount, refetch, setUnreadCount]);

  const handleDelete = useCallback(async (notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId }),
      });
      const deleted = notifications.find((n) => n.id === notificationId);
      if (deleted && !deleted.isRead) {
        setUnreadCount(Math.max(0, (data?.unreadCount || 1) - 1));
      }
      refetch();
    } catch (e) {
      console.error("Failed to delete notification:", e);
    }
  }, [notifications, data?.unreadCount, refetch, setUnreadCount]);

  const dealCount = notifications.filter((n) => n.type === "deal").length;
  const messageCount = notifications.filter((n) => n.type === "message").length;
  const shopCount = notifications.filter((n) => n.type === "shop").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="w-16" />
          <h1 className="text-sm font-bold">Notifications</h1>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><Bell className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-gradient-to-br from-teal-500/10 to-primary/10 border-teal-500/20 cursor-pointer" onClick={() => router.push("/customer/chat")}>
            <CardContent className="p-3 text-center">
              <MessageSquare className="h-5 w-5 text-teal-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{messageCount}</p>
              <p className="text-[10px] text-muted-foreground">Messages</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/10 to-amber-500/10 border-primary/20 cursor-pointer" onClick={() => router.push("/customer/deals")}>
            <CardContent className="p-3 text-center">
              <ShoppingBag className="h-5 w-5 text-brand mx-auto mb-1" />
              <p className="text-lg font-bold">{dealCount}</p>
              <p className="text-[10px] text-muted-foreground">Deals</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-400/10 to-rose-400/10 border-amber-400/20 cursor-pointer" onClick={() => router.push("/customer/locations")}>
            <CardContent className="p-3 text-center">
              <Store className="h-5 w-5 text-amber-400 mx-auto mb-1" />
              <p className="text-lg font-bold">{shopCount}</p>
              <p className="text-[10px] text-muted-foreground">Shops</p>
            </CardContent>
          </Card>
        </div>

        {/* Notification list */}
        <div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-full" /></div>
                    <Skeleton className="h-2 w-10 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            /* Empty state */
            <div className="text-center py-12 space-y-4">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Bell className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">No notifications yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  You&apos;ll see alerts for new messages, deal updates, shop responses, and more here.
                </p>
              </div>
              <div className="flex flex-col gap-2 max-w-xs mx-auto">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => router.push("/customer")}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Browse the Feed
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => router.push("/customer/locations")}>
                  <Store className="h-3.5 w-3.5 mr-1.5" /> Explore Shops
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => router.push("/customer/search")}>
                  <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Search Products
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const Icon = iconMap[n.type] || MapPin;
                return (
                  <Card
                    key={n.id}
                    className={`bg-card border-border cursor-pointer hover:bg-muted/50 transition-colors ${!n.isRead ? "border-primary/20 bg-primary/5" : ""}`}
                    onClick={() => { if (n.actionUrl) router.push(n.actionUrl); }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${colorMap[n.type] || "text-muted-foreground bg-muted"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium truncate">{n.title}</h4>
                            <span className="text-[10px] text-muted-foreground shrink-0">{formatTimeAgo(n.createdAt)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!n.isRead && <div className="w-2 h-2 bg-primary rounded-full" />}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
