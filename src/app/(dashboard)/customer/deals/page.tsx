"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ShoppingBag, Clock, MessageSquare, ChevronRight, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { useChats } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  negotiating: { label: "Negotiating", color: "text-blue-500", bg: "bg-blue-500/10" },
  confirmed: { label: "Confirmed", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  completed: { label: "Completed", color: "text-muted-foreground", bg: "bg-muted" },
  cancelled: { label: "Cancelled", color: "text-destructive", bg: "bg-destructive/10" },
};

export default function DealsListPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data, loading } = useChats(user?.id || null);

  const dealChats = (data?.chats || []).filter((c) => c.type === "deal");
  const filtered = dealChats
    .filter((d) => {
      const matchSearch =
        d.dealInfo?.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.participants.some((p) => p.name?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus =
        statusFilter === "all" || d.dealInfo?.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

  const statusCounts = {
    all: dealChats.length,
    pending: dealChats.filter((d) => d.dealInfo?.status === "pending").length,
    negotiating: dealChats.filter((d) => d.dealInfo?.status === "negotiating").length,
    confirmed: dealChats.filter((d) => d.dealInfo?.status === "confirmed").length,
    completed: dealChats.filter((d) => d.dealInfo?.status === "completed").length,
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-ZM", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="w-16" />
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-brand" />
            <h1 className="text-sm font-bold">My Deals</h1>
          </div>
          <Badge variant="secondary" className="text-[10px]">{dealChats.length}</Badge>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3 max-w-2xl mx-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search deals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {/* Status Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {(["all", "pending", "negotiating", "confirmed", "completed"] as const).map((status) => (
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
                <span className="ml-1 opacity-70">({statusCounts[status]})</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-lg" /><div className="space-y-1.5 flex-1"><Skeleton className="h-3 w-28" /><Skeleton className="h-2 w-20" /></div><Skeleton className="h-5 w-16 rounded-full" /></div>
                <div className="flex gap-3 pl-10"><Skeleton className="h-2 w-20" /><Skeleton className="h-2 w-20" /></div>
                <div className="flex items-center justify-between pl-10"><Skeleton className="h-2 w-32" /><Skeleton className="h-2 w-12" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No deals yet</p>
            <p className="text-xs mt-1">Click &quot;Deal&quot; on a shop&apos;s post to start negotiating</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((deal) => {
              const other = deal.otherParticipant;
              const status = deal.dealInfo?.status || "pending";
              const statusCfg = statusConfig[status] || statusConfig.pending;

              return (
                <Card
                  key={deal.id}
                  className="bg-card border-border hover:border-primary/20 transition-colors cursor-pointer"
                  onClick={() => router.push(`/customer/chat?chatId=${deal.id}`)}
                >
                  <CardContent className="p-3">
                    {/* Top: Shop name + Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center shrink-0">
                          <ShoppingBag className="h-4 w-4 text-brand" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{other?.name || "Shop"}</h3>
                          <p className="text-[10px] text-muted-foreground">{deal.dealInfo?.productName || "Deal"}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] capitalize shrink-0 ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Middle: Price info */}
                    <div className="flex items-center gap-3 mb-2 pl-10">
                      {deal.dealInfo?.initialPrice && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Offer: </span>
                          <span className="font-medium">K{deal.dealInfo.initialPrice.toLocaleString()}</span>
                        </div>
                      )}
                      {deal.dealInfo?.finalPrice && deal.dealInfo.finalPrice !== deal.dealInfo.initialPrice && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Final: </span>
                          <span className="font-bold text-brand">K{deal.dealInfo.finalPrice.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Last message + time */}
                    <div className="flex items-center justify-between pl-10">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                        <p className="text-[11px] text-muted-foreground truncate">
                          {deal.lastMessage?.content || "No messages yet"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{formatTimeAgo(deal.lastMessageTime)}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Timestamp */}
                    <p className="text-[9px] text-muted-foreground/60 pl-10 mt-1">
                      Created {formatDate(deal.createdAt)}
                    </p>
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
              {dealChats.length} total deals · {statusCounts.pending} pending · {statusCounts.negotiating} negotiating
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
