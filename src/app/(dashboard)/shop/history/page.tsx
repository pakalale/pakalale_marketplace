"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShopNav from "@/components/ShopNav";
import {
  Search,
  Loader2,
  History,
  Clock,
  MessageSquare,
  Package,
  CheckCircle2,
  XCircle,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";import { useChats } from "@/hooks/useApi";
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
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    color: "text-emerald-600",
    bg: "bg-emerald-600/10",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive",
    bg: "bg-destructive/10",
    icon: XCircle,
  },
};

export default function DealHistoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const { data, loading } = useChats(user?.id || null);

  const dealChats = (data?.chats || []).filter((c) => c.type === "deal");

  // Filter deals
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

      // Date filter
      if (dateFilter !== "all") {
        const dealDate = new Date(d.createdAt);
        const now = new Date();
        const diffDays =
          (now.getTime() - dealDate.getTime()) / (1000 * 60 * 60 * 24);
        if (dateFilter === "today" && diffDays > 1) return false;
        if (dateFilter === "week" && diffDays > 7) return false;
        if (dateFilter === "month" && diffDays > 30) return false;
      }

      return matchSearch && matchStatus;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt || b.lastMessageTime).getTime() -
        new Date(a.createdAt || a.lastMessageTime).getTime()
    );

  // Summary stats
  const completedDeals = dealChats.filter(
    (d) => d.dealInfo?.status === "completed"
  );
  const totalRevenue = completedDeals.reduce(
    (sum, d) => sum + (d.dealInfo?.counterPrice || d.dealInfo?.initialPrice || 0),
    0
  );
  const totalDeals = dealChats.length;
  const activeDeals = dealChats.filter(
    (d) =>
      d.dealInfo?.status === "pending" ||
      d.dealInfo?.status === "negotiating" ||
      d.dealInfo?.status === "confirmed"
  ).length;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-ZM", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="p-3 sm:p-4 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-brand" />
              Deal History
            </h1>
            <p className="text-xs text-muted-foreground">
              All your deal transactions
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {totalDeals} deals
          </Badge>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-brand">{totalDeals}</p>
              <p className="text-[10px] text-muted-foreground">Total Deals</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-emerald-500">
                {completedDeals.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-yellow-500">
                {activeDeals}
              </p>
              <p className="text-[10px] text-muted-foreground">Active</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue from completed deals */}
        {totalRevenue > 0 && (
          <Card className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  K{totalRevenue.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Revenue from {completedDeals.length} completed deals
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by customer or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 bg-muted border border-border rounded-md text-xs flex-1"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="confirmed">Confirmed</option>
            <option value="negotiating">Negotiating</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2 py-1.5 bg-muted border border-border rounded-md text-xs flex-1"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No deals found</p>
            <p className="text-xs mt-1">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Deal history will appear here"}
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
              const price =
                deal.dealInfo?.counterPrice ||
                deal.dealInfo?.initialPrice ||
                0;

              return (
                <Card
                  key={deal.id}
                  className="bg-card border-border hover:border-primary/20 transition-colors cursor-pointer"
                  onClick={() =>
                    router.push(`/shop/chat?chatId=${deal.id}`)
                  }
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">
                            {other?.name || "Customer"}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] capitalize shrink-0 ${statusCfg.bg} ${statusCfg.color}`}
                          >
                            <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {deal.dealInfo?.productName || "Deal"}
                          {deal.dealInfo?.quantity
                            ? ` × ${deal.dealInfo.quantity}`
                            : ""}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(deal.createdAt || deal.lastMessageTime)}</span>
                          {deal.lastMessage?.content && (
                            <>
                              <span>·</span>
                              <MessageSquare className="h-3 w-3" />
                              <span className="truncate max-w-[120px]">
                                {deal.lastMessage.content}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {price > 0 && (
                          <p
                            className={`text-sm font-bold ${
                              status === "completed"
                                ? "text-emerald-500"
                                : status === "cancelled"
                                  ? "text-destructive line-through"
                                  : "text-brand"
                            }`}
                          >
                            K{price.toLocaleString()}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTimeAgo(deal.lastMessageTime)}
                        </p>
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
