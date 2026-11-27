"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Loader2,
  ReceiptText,
  Search,
  ShoppingBag,
  TrendingUp,
  User,
} from "lucide-react";
import ShopNav from "@/components/ShopNav";
import { Card, CardContent } from "@/components/ui/card";
import { formatKwacha } from "@/lib/product";
import { formatTimeAgo } from "@/lib/formatTime";
import { useAnalytics, useOrders, type OrderData } from "@/hooks/useApi";
import { useAuthStore } from "@/store/authStore";

interface SaleLine {
  name: string;
  quantity: number;
  price: number;
}

interface SaleRecord {
  id: string;
  ref: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: SaleLine[];
  units: number;
  total: number;
  soldAt: Date;
  orderedAt: Date;
}

function customerOf(order: OrderData) {
  const customer = order.customerId;
  if (typeof customer === "string") {
    return { id: customer, name: "Customer", email: "" };
  }
  return {
    id: customer?.id || "",
    name: `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "Customer",
    email: "email" in customer && typeof customer.email === "string" ? customer.email : "",
  };
}

function lineOf(line: OrderData["items"][number]): SaleLine {
  const product = line.productId;
  return {
    name: typeof product === "string" ? "Product" : product?.name || "Product",
    quantity: line.quantity,
    price: line.price,
  };
}

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

export default function SalesRecordsPage() {
  const user = useAuthStore((state) => state.user);
  const { data, loading, error } = useOrders({ shopId: user?.id });
  const { data: analytics } = useAnalytics(user?.id || null);
  const [month, setMonth] = useState("all");
  const [query, setQuery] = useState("");

  const orders = useMemo(() => data?.orders || [], [data]);

  // A sale is recorded when the customer confirms receipt (status `completed`,
  // stamped with `saleRecordedAt`). Older completed orders have no stamp.
  const sales = useMemo<SaleRecord[]>(() => {
    return orders
      .filter(
        (order) =>
          order.status === "completed" ||
          Boolean((order as OrderData & { saleRecordedAt?: string }).saleRecordedAt)
      )
      .map((order) => {
        const customer = customerOf(order);
        const items = order.items.map(lineOf);
        const soldAt = new Date(
          (order as OrderData & { saleRecordedAt?: string }).saleRecordedAt || order.createdAt
        );
        return {
          id: order.id,
          ref: `#${order.id.slice(-6).toUpperCase()}`,
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          items,
          units: items.reduce((sum, item) => sum + item.quantity, 0),
          total: order.total,
          soldAt,
          orderedAt: new Date(order.createdAt),
        };
      })
      .sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime());
  }, [orders]);

  const months = useMemo(() => {
    const keys = Array.from(new Set(sales.map((sale) => monthKey(sale.soldAt))));
    return keys.sort((a, b) => b.localeCompare(a));
  }, [sales]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sales.filter((sale) => {
      if (month !== "all" && monthKey(sale.soldAt) !== month) return false;
      if (!needle) return true;
      return (
        sale.customerName.toLowerCase().includes(needle) ||
        sale.ref.toLowerCase().includes(needle) ||
        sale.items.some((item) => item.name.toLowerCase().includes(needle))
      );
    });
  }, [sales, month, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SaleRecord[]>();
    filtered.forEach((sale) => {
      const key = monthKey(sale.soldAt);
      const bucket = groups.get(key);
      if (bucket) bucket.push(sale);
      else groups.set(key, [sale]);
    });
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const currentMonthKey = monthKey(new Date());
  const thisMonth = sales.filter((sale) => monthKey(sale.soldAt) === currentMonthKey);
  const thisMonthRevenue = thisMonth.reduce((sum, sale) => sum + sale.total, 0);
  // Shop-wide figures come from analytics so they cover every sale, not just this page.
  const totalRevenue = analytics?.stats.totalRevenue || 0;
  const totalSales = analytics?.ordersByStatus.completed || sales.length;

  const summary = [
    {
      label: "This month",
      value: formatKwacha(thisMonthRevenue),
      sub: `${thisMonth.length} ${thisMonth.length === 1 ? "sale" : "sales"}`,
      icon: CalendarDays,
      color: "text-brand",
      bg: "bg-brand-soft",
    },
    {
      label: "Total revenue",
      value: formatKwacha(totalRevenue),
      sub: "all recorded sales",
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Sales recorded",
      value: totalSales.toLocaleString(),
      sub: "completed orders",
      icon: ShoppingBag,
      color: "text-yellow-500",
      bg: "bg-yellow-400/10",
    },
    {
      label: "Average sale",
      value: formatKwacha(analytics?.stats.avgOrderValue || 0),
      sub: "per completed order",
      icon: ReceiptText,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];
  const truncated = orders.length >= 200;

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <ReceiptText className="h-5 w-5 text-brand" />
              Sales record book
            </h1>
            <p className="text-xs text-muted-foreground">
              Every completed sale, who bought it, and when
            </p>
          </div>
          <Link
            href="/shop/analytics"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TrendingUp className="h-4 w-4" />
            Analytics
          </Link>
        </div>

        {/* Money at a glance. */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="border-border bg-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <div className={`shrink-0 rounded-lg p-1.5 ${item.bg}`}>
                    <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                  </div>
                  <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                </div>
                <p className="mt-2 truncate text-lg font-bold sm:text-xl">{item.value}</p>
                <p className="truncate text-[10px] text-muted-foreground">{item.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Month and search filters. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client, product or order number"
              aria-label="Search sales"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="relative">
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              aria-label="Filter sales by month"
              className="h-9 w-full appearance-none rounded-md border border-border bg-background pl-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44"
            >
              <option value="all">All months</option>
              {months.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : error ? (
          <Card className="border-border bg-card">
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium">Could not load sales</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        ) : sales.length === 0 ? (
          <Card className="border-dashed border-border bg-card">
            <CardContent className="px-6 py-12 text-center">
              <ReceiptText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <h2 className="text-sm font-semibold">No sales recorded yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                A sale is written here the moment a customer confirms they received an order.
                Pending and cancelled orders are not counted.
              </p>
              <Link
                href="/shop/orders"
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand/90"
              >
                <ShoppingBag className="h-4 w-4" />
                Go to orders
              </Link>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No sales match that filter.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {truncated && (
              <p className="px-1 text-[10px] text-muted-foreground">
                Showing the 200 most recent orders. Totals above cover every sale.
              </p>
            )}
            {grouped.map(([key, records]) => {
              const monthTotal = records.reduce((sum, sale) => sum + sale.total, 0);
              return (
                <section key={key} aria-label={monthLabel(key)}>
                  <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {monthLabel(key)}
                    </h2>
                    <p className="text-[10px] text-muted-foreground">
                      {records.length} {records.length === 1 ? "sale" : "sales"} ·{" "}
                      <span className="font-semibold text-foreground">{formatKwacha(monthTotal)}</span>
                    </p>
                  </div>

                  <Card className="overflow-hidden border-border bg-card">
                    <CardContent className="divide-y divide-border p-0">
                      {records.map((sale) => (
                        <article key={sale.id} className="p-3 sm:p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                                {sale.customerName
                                  .split(" ")
                                  .map((part) => part[0])
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase() || <User className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0">
                                {sale.customerId ? (
                                  <Link
                                    href={`/shop/profile/${sale.customerId}`}
                                    className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium hover:text-brand hover:underline"
                                  >
                                    <span className="truncate">{sale.customerName}</span>
                                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                                  </Link>
                                ) : (
                                  <p className="truncate text-sm font-medium">{sale.customerName}</p>
                                )}
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {sale.ref}
                                  {sale.customerEmail ? ` · ${sale.customerEmail}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold">{formatKwacha(sale.total)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {sale.units} {sale.units === 1 ? "item" : "items"}
                              </p>
                            </div>
                          </div>

                          <ul className="mt-2.5 space-y-1 pl-0.5">
                            {sale.items.map((item, index) => (
                              <li
                                key={`${sale.id}-${index}`}
                                className="flex items-baseline justify-between gap-3 text-xs"
                              >
                                <span className="min-w-0 truncate text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {item.quantity}×
                                  </span>{" "}
                                  {item.name}
                                </span>
                                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                  {formatKwacha(item.price * item.quantity)}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <p className="mt-2 text-[10px] text-muted-foreground">
                            Sold{" "}
                            <time dateTime={sale.soldAt.toISOString()} title={sale.soldAt.toLocaleString()}>
                              {sale.soldAt.toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </time>{" "}
                            · {formatTimeAgo(sale.soldAt)}
                          </p>
                        </article>
                      ))}
                    </CardContent>
                  </Card>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
