"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import AccountHeading from "@/components/account/AccountHeading";
import StatusBadge from "@/components/account/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders, type OrderData } from "@/hooks/useApi";
import { orderNumber, orderShopName } from "@/lib/orderStatus";
import { formatKwacha } from "@/lib/product";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const TABS = [
  { id: "all", label: "All", match: () => true },
  { id: "active", label: "In progress", match: (order: OrderData) => !["completed", "cancelled"].includes(order.status) },
  { id: "completed", label: "Completed", match: (order: OrderData) => order.status === "completed" },
  { id: "cancelled", label: "Cancelled", match: (order: OrderData) => order.status === "cancelled" },
];

function itemImage(item: OrderData["items"][number]) {
  return typeof item.productId === "object" ? item.productId.images?.find((url) => !/\/video\//.test(url)) : undefined;
}

export default function OrdersPage() {
  const user = useAuthStore((state) => state.user);
  const { data, loading, error, refetch } = useOrders({ customerId: user?.id });
  const [tab, setTab] = useState("all");
  const orders = (data?.orders || []).filter(TABS.find((item) => item.id === tab)!.match);

  return (
    <>
      <AccountHeading title="Orders" description="Track what you have ordered and see the details." />

      <div className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === item.id ? "bg-brand text-brand-foreground" : "bg-muted text-foreground hover:bg-muted/70"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => <Skeleton key={key} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : error && !data ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">We could not load your orders</p>
          <button onClick={refetch} className="mt-2 text-sm font-semibold text-brand hover:underline">Try again</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">{tab === "all" ? "No orders yet" : "Nothing here"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Orders you place will show up here.</p>
          <Link href="/#products" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/customer/orders/${order.id}`} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
                <div className="flex shrink-0 -space-x-3">
                  {order.items.slice(0, 3).map((item, index) => {
                    const image = itemImage(item);
                    return (
                      <span key={index} className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-card bg-muted">
                        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                      </span>
                    );
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">Order {orderNumber(order.id)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {orderShopName(order)} · {new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                  </p>
                </div>
                <p className="hidden shrink-0 font-bold text-brand sm:block">{formatKwacha(order.total)}</p>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
