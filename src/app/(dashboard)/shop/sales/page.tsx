"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShopNav from "@/components/ShopNav";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Users,
  Download,
  Calendar,
  Loader2,
  Package,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { useChats } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";

export default function SalesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dateFilter, setDateFilter] = useState("all");

  const { data, loading } = useChats(user?.id || null);

  const dealChats = (data?.chats || []).filter((c) => c.type === "deal");

  // Completed deals = sales
  const completedDeals = dealChats.filter(
    (d) => d.dealInfo?.status === "completed"
  );

  // Date filtering
  const filteredSales = completedDeals.filter((d) => {
    if (dateFilter === "all") return true;
    const dealDate = new Date(d.createdAt || d.lastMessageTime);
    const now = new Date();
    const diffDays =
      (now.getTime() - dealDate.getTime()) / (1000 * 60 * 60 * 24);
    if (dateFilter === "today") return diffDays <= 1;
    if (dateFilter === "week") return diffDays <= 7;
    if (dateFilter === "month") return diffDays <= 30;
    return true;
  });

  // Sort by most recent
  const sortedSales = [...filteredSales].sort(
    (a, b) =>
      new Date(b.createdAt || b.lastMessageTime).getTime() -
      new Date(a.createdAt || a.lastMessageTime).getTime()
  );

  // Stats
  const totalRevenue = filteredSales.reduce(
    (sum, d) =>
      sum + (d.dealInfo?.counterPrice || d.dealInfo?.initialPrice || 0),
    0
  );
  const totalSales = filteredSales.length;
  const avgSaleValue =
    totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;

  // Unique customers
  const uniqueCustomers = new Set(
    filteredSales
      .map((d) => d.otherParticipant?.id)
      .filter(Boolean)
  ).size;

  // Active deals (potential future sales)
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statCards = [
    {
      icon: DollarSign,
      value: `K${totalRevenue.toLocaleString()}`,
      label: "Total Revenue",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      icon: ShoppingBag,
      value: totalSales.toString(),
      label: "Sales",
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      icon: TrendingUp,
      value: `K${avgSaleValue.toLocaleString()}`,
      label: "Avg Sale",
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      icon: Users,
      value: uniqueCustomers.toString(),
      label: "Customers",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="p-3 sm:p-4 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-brand" />
              Sales
            </h1>
            <p className="text-xs text-muted-foreground">
              Revenue from completed deals
            </p>
          </div>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>

        {/* Stat Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {statCards.map((stat) => (
                <Card
                  key={stat.label}
                  className="bg-card border-border"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="text-base sm:text-lg font-bold mt-0.5">
                          {stat.value}
                        </p>
                      </div>
                      <div
                        className={`p-2 rounded-lg ${stat.bg} shrink-0`}
                      >
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Active pipeline */}
            {activeDeals > 0 && (
              <Card className="bg-gradient-to-r from-blue-500/10 to-primary/10 border-blue-500/20">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium">
                        {activeDeals} active deal{activeDeals !== 1 ? "s" : ""} in pipeline
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Pending negotiation or confirmation
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => router.push("/shop/orders")}
                  >
                    View
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Date Filter */}
            <div className="flex gap-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 bg-muted border border-border rounded-md text-xs flex-1"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            {/* Sales List */}
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="p-3 border-b border-border">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Completed Sales ({sortedSales.length})
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {sortedSales.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No sales yet</p>
                      <p className="text-xs mt-1">
                        Completed deals will appear here as sales
                      </p>
                    </div>
                  ) : (
                    sortedSales.map((sale) => {
                      const price =
                        sale.dealInfo?.counterPrice ||
                        sale.dealInfo?.initialPrice ||
                        0;

                      return (
                        <div
                          key={sale.id}
                          className="p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() =>
                            router.push(`/shop/chat?chatId=${sale.id}`)
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium truncate">
                                  {sale.otherParticipant?.name ||
                                    "Customer"}
                                </h4>
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] bg-emerald-500/10 text-emerald-500"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                  Sold
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {sale.dealInfo?.productName || "Deal"}
                                {sale.dealInfo?.quantity
                                  ? ` × ${sale.dealInfo.quantity}`
                                  : ""}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDate(
                                    sale.createdAt || sale.lastMessageTime
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-emerald-500">
                                K{price.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatTimeAgo(sale.lastMessageTime)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
