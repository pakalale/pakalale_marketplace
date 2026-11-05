"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShopNav from "@/components/ShopNav";
import {
  Search,
  Loader2,
  ShoppingBag,
  Clock,
  MessageSquare,
  ChevronRight,
  Package,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { useDealStore } from "@/store/dealStore";
import { useChats, updateDealStatus } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    icon: Clock,
  },
  negotiating: {
    label: "Negotiating",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    icon: MessageSquare,
  },
  confirmed: {
    label: "Confirmed",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    icon: CheckCircle,
  },
  completed: {
    label: "Completed",
    color: "text-muted-foreground",
    bg: "bg-muted",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive",
    bg: "bg-destructive/10",
    icon: XCircle,
  },
};

export default function ShopDealsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingDeal, setUpdatingDeal] = useState<string | null>(null);

  const { data, loading, refetch } = useChats(user?.id || null);

  const dealChats = (data?.chats || []).filter((c) => c.type === "deal");
  const filtered = dealChats
    .filter((d) => {
      const matchSearch =
        d.dealInfo?.productName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        d.participants.some((p) =>
          p.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchStatus =
        statusFilter === "all" || d.dealInfo?.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() -
        new Date(a.lastMessageTime).getTime()
    );

  const statusCounts = {
    all: dealChats.length,
    pending: dealChats.filter((d) => d.dealInfo?.status === "pending").length,
    negotiating: dealChats.filter(
      (d) => d.dealInfo?.status === "negotiating"
    ).length,
    confirmed: dealChats.filter(
      (d) => d.dealInfo?.status === "confirmed"
    ).length,
    completed: dealChats.filter(
      (d) => d.dealInfo?.status === "completed"
    ).length,
  };

  const handleStatusUpdate = async (
    chatId: string,
    newStatus: string
  ) => {
    if (!user?.id) return;
    setUpdatingDeal(chatId);
    try {
      const result = await updateDealStatus(chatId, newStatus, user.id);

      // Use exact count from API if available, otherwise decrement
      if (result && typeof result.totalDeals === "number") {
        useDealStore.getState().setDealCount(result.totalDeals);
      } else if (newStatus === "completed" || newStatus === "cancelled") {
        useDealStore.getState().decrementDealCount();
      }

      // Notify other participants via socket
      const chat = dealChats.find((c) => c.id === chatId);
      const participantIds = chat?.participants?.map((p) => p.id) || [];
      window.dispatchEvent(
        new CustomEvent("deal-status-changed", {
          detail: { chatId, dealStatus: newStatus, participantIds },
        })
      );

      refetch();
    } catch (e) {
      console.error("Failed to update deal status:", e);
    } finally {
      setUpdatingDeal(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="p-3 sm:p-4 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-brand" />
              Deals
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage your customer deals
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {dealChats.length} total
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter Chips */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {(
            ["all", "pending", "negotiating", "confirmed", "completed"] as const
          ).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {status === "all" ? "All" : statusConfig[status]?.label}
              {statusCounts[status] > 0 && (
                <span className="ml-1 opacity-70">
                  ({statusCounts[status]})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No deals yet</p>
            <p className="text-xs mt-1">
              When customers make deals on your products, they&apos;ll appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((deal) => {
              const other = deal.otherParticipant;
              const status = deal.dealInfo?.status || "pending";
              const statusCfg =
                statusConfig[status] || statusConfig.pending;
              const StatusIcon = statusCfg.icon;
              const isUpdating = updatingDeal === deal.id;

              return (
                <Card
                  key={deal.id}
                  className="bg-card border-border hover:border-primary/20 transition-colors"
                >
                  <CardContent className="p-3">
                    {/* Top: Customer name + Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center shrink-0">
                          <ShoppingBag className="h-4 w-4 text-brand" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">
                            {other?.name || "Customer"}
                          </h3>
                          <p className="text-[10px] text-muted-foreground">
                            {deal.dealInfo?.productName || "Deal"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] capitalize shrink-0 ${statusCfg.bg} ${statusCfg.color}`}
                      >
                        <StatusIcon className="h-2.5 w-2.5 mr-1" />
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Middle: Price info */}
                    <div className="flex items-center gap-3 mb-2 pl-10">
                      {deal.dealInfo?.initialPrice && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            Customer offer:{" "}
                          </span>
                          <span className="font-medium">
                            K{deal.dealInfo.initialPrice.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {deal.dealInfo?.counterPrice && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            Current:{" "}
                          </span>
                          <span className="font-bold text-brand">
                            K{deal.dealInfo.counterPrice.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {deal.dealInfo?.quantity && (
                        <div className="text-xs text-muted-foreground">
                          Qty: {deal.dealInfo.quantity}
                        </div>
                      )}
                    </div>

                    {/* Bottom: Last message + time */}
                    <div className="flex items-center justify-between pl-10 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                        <p className="text-[11px] text-muted-foreground truncate">
                          {deal.lastMessage?.content || "No messages yet"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimeAgo(deal.lastMessageTime)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons for shop owner */}
                    <div className="flex items-center gap-2 pl-10">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] flex-1"
                        onClick={() =>
                          router.push(
                            `/shop/chat?chatId=${deal.id}`
                          )
                        }
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Chat
                      </Button>

                      {status === "pending" && (
                        <Button
                          size="sm"
                          className="h-7 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                          onClick={() =>
                            router.push(`/shop/chat?chatId=${deal.id}`)
                          }
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Respond & Negotiate
                        </Button>
                      )}

                      {status === "negotiating" && (
                        <Button
                          size="sm"
                          className="h-7 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                          onClick={() =>
                            router.push(`/shop/chat?chatId=${deal.id}`)
                          }
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Open Chat to Counter
                        </Button>
                      )}

                      {status === "confirmed" && (
                        <Button
                          size="sm"
                          className="h-7 text-[10px] bg-emerald-600 text-white hover:bg-emerald-700 flex-1"
                          onClick={() =>
                            handleStatusUpdate(deal.id, "completed")
                          }
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          Complete Deal
                        </Button>
                      )}

                      {(status === "pending" || status === "negotiating") && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-[10px] flex-1"
                          onClick={() =>
                            handleStatusUpdate(deal.id, "cancelled")
                          }
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          Cancel Deal
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {dealChats.length > 0 && (
          <div className="text-center pt-2">
            <p className="text-[10px] text-muted-foreground">
              {dealChats.length} total deals · {statusCounts.pending}{" "}
              pending · {statusCounts.negotiating} negotiating ·{" "}
              {statusCounts.confirmed} confirmed
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
