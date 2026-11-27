"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ShopNav from "@/components/ShopNav";
import Feed from "@/components/Feed";
import { useAuthStore } from "@/store/authStore";
import { useAnalytics } from "@/hooks/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeAgo } from "@/lib/formatTime";
import { ArrowUpRight, Store, TrendingUp } from "lucide-react";
import ShopCompletionCard from "@/components/ShopCompletionCard";

export default function ShopFeedPage() {
  const { user } = useAuthStore();
  const [showWelcome, setShowWelcome] = useState(false);
  const { data: analytics } = useAnalytics(user?.id || null);
  const stats = analytics?.stats;

  useEffect(() => {
    if (!user?.id) return;
    const key = `shopWelcomeShown:${user.id}`;
    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      setShowWelcome(true);
      hideTimer = window.setTimeout(() => setShowWelcome(false), 5000);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [user?.id]);

  const todaySales = analytics?.salesSummary?.today ?? { count: 0, revenue: 0 };
  const weekSales = analytics?.salesSummary?.week ?? { count: 0, revenue: 0 };
  const pendingOrders =
    (analytics?.ordersByStatus?.order_placed ?? 0) +
    (analytics?.ordersByStatus?.approved ?? 0) +
    (analytics?.ordersByStatus?.agent_assigned ?? 0) +
    (analytics?.ordersByStatus?.delivery_in_progress ?? 0);
  const topSellers = (analytics?.topSellingProducts ?? []).slice(0, 3);
  const latestSale = analytics?.recentSales?.[0];

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto w-full max-w-6xl p-3 sm:p-5 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
        <div className="space-y-4">
          {showWelcome && <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-amber-golden/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-brand shrink-0" />
                <div>
                  <h2 className="text-lg font-bold">Hey, {user?.firstName} 👋</h2>
                  <p className="text-xs text-muted-foreground">What&apos;s happening in your community</p>
                </div>
              </div>
            </CardContent>
          </Card>}

          <ShopCompletionCard />

          {/* Community Feed */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-brand" />
                Community Feed
              </h3>
            </div>
            <Feed />
          </div>
        </div>

        {/* Desktop rail: a live business snapshot that fills the viewport beside the feed. */}
        <aside className="hidden xl:sticky xl:top-4 xl:block xl:h-[calc(100vh-2rem)]">
          <Card className="flex h-full flex-col overflow-hidden border-border bg-card">
            <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Store className="h-4 w-4 text-brand" />
                  Your shop
                </h3>
                <Link
                  href="/shop/overview"
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand hover:underline"
                >
                  My Shop <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              {/* The number a seller opens the app for. */}
              <div className="rounded-xl border border-brand/15 bg-gradient-to-br from-brand/10 via-brand/5 to-amber-golden/10 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sales today
                </p>
                <p className="mt-0.5 text-2xl font-bold leading-tight">
                  K{todaySales.revenue.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {todaySales.count} {todaySales.count === 1 ? "sale" : "sales"} · K
                  {weekSales.revenue.toLocaleString()} in the last 7 days
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                  <p className="text-sm font-bold">{pendingOrders}</p>
                  <p className="text-[10px] text-muted-foreground">Pending orders</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                  <p className="truncate text-sm font-bold">
                    K{(stats?.avgOrderValue ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Avg order</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                  <p className="text-sm font-bold">{(stats?.totalProducts ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Products</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                  <p className="text-sm font-bold">
                    {(stats?.shopTotalViews ?? stats?.totalViews ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Shop views</p>
                </div>
              </div>

              {topSellers.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Top sellers
                    </p>
                    <Link href="/shop/overview" className="text-[10px] font-medium text-brand hover:underline">
                      See all
                    </Link>
                  </div>
                  <ul className="space-y-1.5">
                    {topSellers.map((product, index) => (
                      <li key={product.id} className="flex items-center gap-2 text-xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{product.name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {product.sold} sold
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pinned to the bottom so the rail reads as a full-height panel. */}
              <div className="mt-auto space-y-2 border-t border-border pt-3">
                {latestSale ? (
                  <Link href="/shop/overview" className="-m-1 block rounded-lg p-1 transition-colors hover:bg-muted/60">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Latest sale · {formatTimeAgo(latestSale.createdAt)}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium">
                      {latestSale.customer} · K{latestSale.total.toLocaleString()}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {latestSale.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
                    </p>
                  </Link>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    No sales yet — completed orders show up here.
                  </p>
                )}
                <Link
                  href="/shop/orders"
                  className="flex items-center justify-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90"
                >
                  Manage orders
                </Link>
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
