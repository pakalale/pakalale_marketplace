"use client";

import Link from "next/link";
import {
  BarChart3,
  Eye,
  Loader2,
  Package,
  ReceiptText,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import ShopNav from "@/components/ShopNav";
import { Card, CardContent } from "@/components/ui/card";
import { useAnalytics } from "@/hooks/useApi";
import { useAuthStore } from "@/store/authStore";
import { formatKwacha } from "@/lib/product";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orderStatus";

const STATUS_COLORS: Record<string, string> = {
  order_placed: "bg-yellow-400",
  approved: "bg-blue-400",
  agent_assigned: "bg-indigo-400",
  delivery_in_progress: "bg-purple-400",
  delivered: "bg-cyan-400",
  completed: "bg-emerald-500",
  cancelled: "bg-rose-400",
};

const CATEGORY_COLORS = [
  "bg-brand",
  "bg-emerald-500",
  "bg-yellow-400",
  "bg-purple-400",
  "bg-blue-400",
  "bg-rose-400",
];

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const { data: analytics, loading } = useAnalytics(user?.id || null);

  const stats = analytics?.stats;
  const trend = analytics?.salesTrend || [];
  const categories = analytics?.salesByCategory || [];
  const customers = analytics?.customers;
  const bestSellers = analytics?.topSellingProducts || [];
  const topProducts = analytics?.topProducts || [];
  const ordersByStatus = analytics?.ordersByStatus || {};
  const salesSummary = analytics?.salesSummary;

  const trendMax = Math.max(...trend.map((month) => month.revenue), 0);
  const trendRevenue = trend.reduce((sum, month) => sum + month.revenue, 0);
  const trendSales = trend.reduce((sum, month) => sum + month.count, 0);
  const categoryMax = Math.max(...categories.map((category) => category.revenue), 0);
  const bestSellerMax = Math.max(...bestSellers.map((product) => product.sold), 0);
  const statusTotal = ORDER_STATUSES.reduce(
    (sum, status) => sum + (ordersByStatus[status] || 0),
    0
  );
  const repeatRate =
    customers && customers.total > 0 ? Math.round((customers.repeat / customers.total) * 100) : 0;

  const kpis = stats
    ? [
        {
          label: "Total revenue",
          value: formatKwacha(stats.totalRevenue),
          icon: TrendingUp,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
        },
        {
          label: "Orders",
          value: stats.totalOrders.toLocaleString(),
          icon: ShoppingBag,
          color: "text-brand",
          bg: "bg-brand-soft",
          href: "/shop/orders",
        },
        {
          label: "Shop views",
          value: (stats.shopTotalViews || stats.totalViews).toLocaleString(),
          icon: Eye,
          color: "text-blue-400",
          bg: "bg-blue-400/10",
          href: "/shop/visitors",
        },
        {
          label: "Avg order",
          value: formatKwacha(stats.avgOrderValue || 0),
          icon: ReceiptText,
          color: "text-yellow-500",
          bg: "bg-yellow-400/10",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <BarChart3 className="h-5 w-5 text-brand" />
              Analytics
            </h1>
            <p className="text-xs text-muted-foreground">
              Sales, products and customers at a glance
            </p>
          </div>
          <Link
            href="/shop/sales"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ReceiptText className="h-4 w-4" />
            Sales records
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              {kpis.map((kpi) => (
                kpi.href ? (
                  <Link key={kpi.label} href={kpi.href} className="rounded-xl border border-border bg-card p-0 transition-colors hover:border-primary/30">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2">
                        <div className={`shrink-0 rounded-lg p-1.5 ${kpi.bg}`}>
                          <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                        </div>
                        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {kpi.label}
                        </p>
                      </div>
                      <p className="mt-2 truncate text-lg font-bold sm:text-xl">{kpi.value}</p>
                    </CardContent>
                  </Link>
                ) : (
                  <Card key={kpi.label} className="border-border bg-card">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2">
                        <div className={`shrink-0 rounded-lg p-1.5 ${kpi.bg}`}>
                          <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                        </div>
                        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {kpi.label}
                        </p>
                      </div>
                      <p className="mt-2 truncate text-lg font-bold sm:text-xl">{kpi.value}</p>
                    </CardContent>
                  </Card>
                )
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Revenue trend — one bar per month, scaled to the best month. */}
              <Card className="border-border bg-card lg:col-span-2">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">Sales trend</h2>
                      <p className="text-[10px] text-muted-foreground">Last 6 months</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatKwacha(trendRevenue)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {trendSales} {trendSales === 1 ? "sale" : "sales"}
                      </p>
                    </div>
                  </div>

                  {trendMax === 0 ? (
                    <div className="mt-3 flex h-40 items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground">
                      No sales in the last 6 months
                    </div>
                  ) : (
                    <div className="mt-4 flex h-40 items-end gap-1.5 sm:gap-3">
                      {trend.map((month, index) => {
                        const height = Math.max((month.revenue / trendMax) * 100, 2);
                        const isCurrent = index === trend.length - 1;
                        return (
                          <div
                            key={month.month}
                            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                          >
                            <span className="w-full truncate text-center text-[9px] tabular-nums text-muted-foreground">
                              {month.revenue > 0 ? formatKwacha(month.revenue) : ""}
                            </span>
                            <div
                              className={`w-full rounded-t-md transition-all duration-500 ${
                                isCurrent ? "bg-brand" : "bg-brand/40"
                              }`}
                              style={{ height: `${height}%` }}
                              title={`${month.label}: ${formatKwacha(month.revenue)} · ${month.count} sales`}
                            />
                            <span
                              className={`text-[10px] ${
                                isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {month.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Today
                      </p>
                      <p className="text-sm font-semibold">
                        {formatKwacha(salesSummary?.today.revenue || 0)}{" "}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          ({salesSummary?.today.count || 0} sales)
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Last 7 days
                      </p>
                      <p className="text-sm font-semibold">
                        {formatKwacha(salesSummary?.week.revenue || 0)}{" "}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          ({salesSummary?.week.count || 0} sales)
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category mix — where the item sales come from. */}
              <Card className="border-border bg-card">
                <CardContent className="p-3 sm:p-4">
                  <h2 className="text-sm font-semibold">Sales by category</h2>
                  <p className="text-[10px] text-muted-foreground">Item sales, all time</p>

                  {categories.length === 0 ? (
                    <div className="mt-3 flex h-40 items-center justify-center rounded-lg bg-muted/40 text-center text-xs text-muted-foreground">
                      Nothing sold yet
                    </div>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {categories.map((category, index) => (
                        <li key={category.category}>
                          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                            <span className="truncate font-medium">{category.category}</span>
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {formatKwacha(category.revenue)}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}`}
                              style={{
                                width: `${categoryMax > 0 ? Math.max((category.revenue / categoryMax) * 100, 3) : 0}%`,
                              }}
                            />
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {category.units} {category.units === 1 ? "item" : "items"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Products: units actually sold. */}
              <Card className="border-border bg-card">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-brand" />
                    <h2 className="text-sm font-semibold">Best sellers</h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Units sold</p>

                  {bestSellers.length === 0 ? (
                    <p className="mt-6 text-center text-xs text-muted-foreground">
                      No products sold yet
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {bestSellers.slice(0, 5).map((product, index) => (
                        <li key={product.id}>
                          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-baseline gap-1.5">
                              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                                {index + 1}.
                              </span>
                              <span className="truncate font-medium">{product.name}</span>
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {product.sold}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{
                                width: `${bestSellerMax > 0 ? Math.max((product.sold / bestSellerMax) * 100, 3) : 0}%`,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Customers: size, loyalty and value. */}
              <Card className="border-border bg-card">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand" />
                    <h2 className="text-sm font-semibold">Customers</h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground">People who completed an order</p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xl font-bold">{customers?.total || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Total customers</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{customers?.newThisMonth || 0}</p>
                      <p className="text-[10px] text-muted-foreground">New this month</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{customers?.repeat || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Repeat buyers</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{formatKwacha(customers?.avgSpend || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">Avg spend</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-3">
                    <div className="mb-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
                      <span>Repeat rate</span>
                      <span className="font-semibold text-foreground">{repeatRate}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${repeatRate}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Orders: pipeline health. */}
              <Card className="border-border bg-card">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-brand" />
                    <h2 className="text-sm font-semibold">Orders by status</h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground">All orders</p>

                  {statusTotal === 0 ? (
                    <p className="mt-6 text-center text-xs text-muted-foreground">No orders yet</p>
                  ) : (
                    <>
                      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        {ORDER_STATUSES.map((status) => {
                          const count = ordersByStatus[status] || 0;
                          if (count === 0) return null;
                          return (
                            <div
                              key={status}
                              className={STATUS_COLORS[status]}
                              style={{ width: `${(count / statusTotal) * 100}%` }}
                              title={`${ORDER_STATUS_LABELS[status]}: ${count}`}
                            />
                          );
                        })}
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {ORDER_STATUSES.map((status) => {
                          const count = ordersByStatus[status] || 0;
                          if (count === 0) return null;
                          return (
                            <li
                              key={status}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[status]}`}
                                />
                                <span className="truncate text-muted-foreground">
                                  {ORDER_STATUS_LABELS[status]}
                                </span>
                              </span>
                              <span className="shrink-0 font-medium tabular-nums">{count}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-border bg-card lg:col-span-2">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-brand" />
                    <h2 className="text-sm font-semibold">Shop health</h2>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-lg font-bold text-brand">{stats?.conversionRate || 0}%</p>
                      <p className="text-[10px] text-muted-foreground">Views → sales</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-500">{stats?.responseRate || 0}%</p>
                      <p className="text-[10px] text-muted-foreground">Response rate</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-yellow-500">
                        {stats?.shopRating || 0}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({stats?.shopReviews || 0})
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">Rating</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{stats?.totalProducts || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Products listed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-brand" />
                    <h2 className="text-sm font-semibold">Most viewed</h2>
                  </div>
                  <ul className="mt-3 divide-y divide-border">
                    {topProducts.length === 0 ? (
                      <li className="py-3 text-xs text-muted-foreground">No products yet</li>
                    ) : (
                      topProducts.slice(0, 3).map((product) => (
                        <li
                          key={product.id}
                          className="flex items-center justify-between gap-2 py-2 text-xs"
                        >
                          <span className="truncate font-medium">{product.name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {product.views} views
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
