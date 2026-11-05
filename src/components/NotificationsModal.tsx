"use client";

import { Bell, ShoppingBag, Star, MessageSquare, MapPin, Package, Info, Loader2 } from "lucide-react";
import { useModalBack } from "@/hooks/useModalBack";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/formatTime";
import { useNotifications, markNotificationsRead, type NotificationData } from "@/hooks/useApi";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

const iconMap: Record<string, React.ElementType> = {
  deal: ShoppingBag,
  message: MessageSquare,
  review: Star,
  location: MapPin,
  shop: MapPin,
  order: Package,
  system: Info,
};

const colorMap: Record<string, string> = {
  deal: "text-brand bg-primary/10",
  message: "text-teal-500 bg-teal-500/10",
  review: "text-rose-400 bg-rose-400/10",
  location: "text-amber-400 bg-amber-400/10",
  shop: "text-amber-400 bg-amber-400/10",
  order: "text-blue-400 bg-blue-400/10",
  system: "text-muted-foreground bg-muted",
};

export default function NotificationsModal({ isOpen, onClose, userId }: NotificationsModalProps) {
  useModalBack(isOpen, onClose);
  const { data, loading, refetch } = useNotifications(userId);

  const notifications = data?.notifications || [];

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await markNotificationsRead(userId);
    refetch();
  };



  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand" />
            Notifications
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = iconMap[notification.type] || Bell;
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors",
                    !notification.isRead && "bg-muted/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg shrink-0", colorMap[notification.type] || "text-muted-foreground bg-muted")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium truncate">{notification.title}</h4>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-border shrink-0">
          <Button variant="ghost" className="w-full text-brand hover:text-brand/80" onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
