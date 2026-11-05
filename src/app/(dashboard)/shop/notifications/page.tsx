"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import ShopNav from "@/components/ShopNav";
import {
  MessageSquare,
  Store,
  Heart,
  MapPin,
  Package,
  Info,
  Bell,
  Trash2,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import {
  useNotifications,
  markNotificationsRead,
  type NotificationData,
} from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";

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

export default function ShopNotificationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, loading, refetch } = useNotifications(user?.id || null);
  const [clearing, setClearing] = useState(false);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Mark all as read on visit
  useEffect(() => {
    if (user?.id && unreadCount > 0) {
      markNotificationsRead(user.id).then(() => refetch());
    }
  }, [user?.id, unreadCount, refetch]);

  const handleDelete = useCallback(
    async (notificationId: string) => {
      try {
        await fetch("/api/notifications", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notificationId }),
        });
        refetch();
      } catch (e) {
        console.error("Failed to delete notification:", e);
      }
    },
    [refetch]
  );

  const handleClearAll = async () => {
    if (!user?.id) return;
    setClearing(true);
    try {
      await markNotificationsRead(user.id);
      refetch();
    } finally {
      setClearing(false);
    }
  };

  const dealCount = notifications.filter((n) => n.type === "deal").length;
  const messageCount = notifications.filter(
    (n) => n.type === "message"
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="p-3 sm:p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand" />
              Notifications
            </h1>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAll}
              disabled={clearing}
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Bell className="h-4 w-4 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2">
          <Card
            className="bg-gradient-to-br from-teal-500/10 to-primary/10 border-teal-500/20 cursor-pointer hover:border-teal-500/40 transition-colors"
            onClick={() => router.push("/shop/chat")}
          >
            <CardContent className="p-3 text-center">
              <MessageSquare className="h-5 w-5 text-teal-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{messageCount}</p>
              <p className="text-[10px] text-muted-foreground">Messages</p>
            </CardContent>
          </Card>
          <Card
            className="bg-gradient-to-br from-primary/10 to-amber-500/10 border-primary/20 cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => router.push("/shop/deals")}
          >
            <CardContent className="p-3 text-center">
              <ShoppingBag className="h-5 w-5 text-brand mx-auto mb-1" />
              <p className="text-lg font-bold">{dealCount}</p>
              <p className="text-[10px] text-muted-foreground">Deal Alerts</p>
            </CardContent>
          </Card>
        </div>

        {/* Notification list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">No notifications yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                You&apos;ll see alerts for new messages, deal updates, and
                customer activity here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = iconMap[n.type] || Info;
              return (
                <Card
                  key={n.id}
                  className={`bg-card border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                    !n.isRead
                      ? "border-primary/20 bg-primary/5"
                      : ""
                  }`}
                  onClick={() => {
                    if (n.actionUrl) router.push(n.actionUrl);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          colorMap[n.type] || "text-muted-foreground bg-muted"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-medium truncate">
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatTimeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!n.isRead && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(n.id);
                          }}
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
      </main>
    </div>
  );
}
