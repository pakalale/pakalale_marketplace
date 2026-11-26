"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Loader2,
  Package,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import ShopNav from "@/components/ShopNav";
import { Card, CardContent } from "@/components/ui/card";
import VisitorDropdownCard from "@/components/VisitorDropdownCard";
import VisitorPanel from "@/components/VisitorPanel";
import { useAnalytics } from "@/hooks/useApi";
import { useAuthStore } from "@/store/authStore";
import { formatTimeAgo } from "@/lib/formatTime";

export default function OverviewPage() {
  const { user } = useAuthStore();
  const { data: analytics, loading } = useAnalytics(user?.id || null);

  const stats = analytics?.stats;
  const recentSales = analytics?.recentSales || [];
  const salesSummary = analytics?.salesSummary;
  const topSellingProducts = analytics?.topSellingProducts || [];
  const completedCount = (analytics?.ordersByStatus?.completed || 0) + (analytics?.ordersByStatus?.received || 0);

  const today = salesSummary?.today || { count: 0, revenue: 0 };
  const week = salesSummary?.week || { count: 0, revenue: 0 };
  const statCards = stats
    ? [
        {
          icon: ShoppingBag,
          value: stats.totalOrders.toLocaleString(),
          label: "Orders",
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
          href: "/shop/orders",
        },
        {
          icon: TrendingUp,
          value: `K${today.revenue.toLocaleString()}`,
          label: "Today's sales",
          color: "text-yellow-500",
          bg: "bg-yellow-400/10",
          href: "/shop/sales",
        },
        {
          icon: Star,
          value: `${stats.shopRating || 0}`,
          label: "Rating",
          color: "text-purple-400",
          bg: "bg-purple-400/10",
          href: "/shop/virtual-shop",
        },
        {
          icon: Users,
          value: `${stats.shopReviews || 0}`,
          label: "Reviews",
          color: "text-pink-400",
          bg: "bg-pink-400/10",
          href: "/shop/virtual-shop",
        },
      ]
    : [];

  const pageLinks = [
    {
      href: "/shop/sales",
      label: "Sales record book",
      hint: "Monthly takings and client history",
      icon: ReceiptText,
    },
    {
      href: "/shop/analytics",
      label: "Analytics",
      hint: "Sales, products and customer charts",
      icon: BarChart3,
    },
    {
      href: "/shop/smart-products",
      label: "Smart products",
      hint: "Restock and promotion notices",
      icon: Sparkles,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto flex max-w-7xl flex-col gap-3 p-3 sm:p-5 lg:h-[calc(100dvh-3.5rem-1px)] lg:overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold leading-tight">My Shop</h1>
            <p className="text-[11px] text-muted-foreground">
              Sales, orders and store traffic in one view
            </p>
          </div>
          <Link
            href="/shop/virtual-shop"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Store className="h-4 w-4" />
            Storefront
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <>
            {/* Headline stats: compact on mobile (2-col), full size on sm+. */}
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-5">
              {statCards.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  aria-label={`Open ${stat.label}`}
                  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full border-border bg-card transition-colors hover:border-primary/30">
                    <CardContent className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5">
                      <div className={`shrink-0 rounded-lg p-1 sm:p-1.5 ${stat.bg}`}>
                        <stat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm sm:text-base font-bold leading-tight">{stat.value}</p>
                        <p className="truncate text-[9px] sm:text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              <VisitorDropdownCard ownerId={user?.id || null} />
            </div>

            {/* Sub-page links: one row on mobile too, 3 across always. */}
            <div className="grid grid-cols-3 gap-2">
              {pageLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-2 rounded-lg border border-border bg-card p-2 transition-colors hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="shrink-0 rounded-lg bg-brand-soft p-1">
                    <link.icon className="h-3.5 w-3.5 text-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold">{link.label}</p>
                    <p className="truncate text-[9px] text-muted-foreground">{link.hint}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </Link>
              ))}
            </div>

            {/* Visitors panel: full-width on mobile when open, hidden in the grid on desktop. */}
            <VisitorPanel ownerId={user?.id || null} />

            {/* Main board: sale review (left) and shop stats + top sellers (right). Equal height on desktop. */}
            <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
              <Card className="flex flex-col overflow-hidden border-border bg-card h-full lg:col-span-7 lg:min-h-0">
                <CardContent className="flex flex-col p-0 min-h-0 lg:min-h-0 lg:flex-1">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      <TrendingUp className="h-4 w-4 text-brand" />
                      Today&apos;s sale review
                    </h2>
                    <Link
                      href="/shop/sales"
                      className="text-[11px] font-medium text-brand hover:underline"
                    >
                      Record book
                    </Link>
                  </div>
                  <div className="grid shrink-0 grid-cols-4 divide-x divide-border border-b border-border">
                    <div className="p-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Today
                      </p>
                      <p className="truncate text-sm font-bold">K{today.revenue.toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">{today.count} sales</p>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Avg sale
                      </p>
                      <p className="truncate text-sm font-bold">
                        K{(stats?.avgOrderValue || 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {completedCount || 0} sales
                      </p>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        7 days
                      </p>
                      <p className="truncate text-sm font-bold">K{week.revenue.toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">{week.count} sales</p>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        All time
                      </p>
                      <p className="truncate text-sm font-bold">
                        K{(stats?.totalRevenue || 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {stats?.totalOrders || 0} orders
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-border min-h-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                    {recentSales.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No sales yet. Completed orders show up here.
                      </div>
                    ) : (
                      recentSales.map((sale) => (
                        <div
                          key={sale.id}
                          className="flex items-start justify-between gap-3 p-2.5 transition-colors hover:bg-muted/30"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{sale.customer}</p>
                            <p className="line-clamp-1 text-[11px] text-muted-foreground">
                              {sale.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {formatTimeAgo(sale.createdAt)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold">K{sale.total.toLocaleString()}</p>
                            <p className="text-[9px] text-muted-foreground">
                              {sale.units} {sale.units === 1 ? "item" : "items"}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right rail: health stats + top sellers. Same height as sale review on desktop. */}
              <div className="flex flex-col gap-3 min-h-0 lg:col-span-5 lg:min-h-0 lg:flex-1">
                <Card className="flex flex-col border-border bg-card h-full">
                  <CardContent className="flex flex-col p-0 flex-1 min-h-0">
                    <div className="shrink-0 grid grid-cols-3 divide-x divide-border border-b border-border">
                      <div className="p-2 text-center">
                        <p className="text-sm font-bold text-brand">
                          {stats?.conversionRate || 0}%
                        </p>
                        <p className="text-[9px] text-muted-foreground">Conversion</p>
                      </div>
                      <div className="p-2 text-center">
                        <p className="text-sm font-bold text-emerald-500">
                          {stats?.responseRate || 0}%
                        </p>
                        <p className="text-[9px] text-muted-foreground">Response</p>
                      </div>
                      <div className="p-2 text-center">
                        <p className="text-sm font-bold text-yellow-500">
                          K{(stats?.avgOrderValue || 0).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Avg order</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 p-2.5 pb-1.5 border-b border-border">
                      <Package className="h-3.5 w-3.5 text-brand" />
                      <p className="text-xs font-semibold">Top sellers</p>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-border">
                      {topSellingProducts.length === 0 ? (
                        <p className="px-2.5 py-2.5 text-[11px] text-muted-foreground">
                          Nothing sold yet
                        </p>
                      ) : (
                        topSellingProducts.slice(0, 5).map((product, index) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9px] font-semibold text-brand">
                                {index + 1}
                              </span>
                              <p className="truncate text-[11px] font-medium">{product.name}</p>
                            </div>
                            <p className="shrink-0 text-[9px] text-muted-foreground">
                              {product.sold} sold
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
