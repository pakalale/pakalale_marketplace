"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Heart, MapPin, Package, ShoppingCart, Users } from "lucide-react";
import StatusBadge from "@/components/account/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/useHydrated";
import { useOrders } from "@/hooks/useApi";
import { orderNumber, orderShopName } from "@/lib/orderStatus";
import { formatKwacha } from "@/lib/product";
import { useAuthStore } from "@/store/authStore";
import { cartItemCount, useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

function Stat({ href, icon: Icon, label, value }: { href: string; icon: typeof Package; label: string; value: number | string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-muted">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold text-brand">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </Link>
  );
}

export default function AccountOverviewPage() {
  const user = useAuthStore((state) => state.user);
  const mounted = useHydrated();
  const cartCount = useCartStore((state) => cartItemCount(state.items));
  const savedCount = useWishlistStore((state) => state.items.length);
  const { data, loading } = useOrders({ customerId: user?.id });
  const orders = data?.orders || [];
  const active = orders.filter((order) => !["completed", "cancelled"].includes(order.status));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#002583] p-5 text-white sm:p-6">
        <p className="text-sm text-white/75">Welcome back</p>
        <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">Hi, {user?.firstName || "there"}!</h1>
        <p className="mt-1 text-sm text-white/80">Track orders, manage addresses and pick up where you left off.</p>
        <Link href="/" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#ffb800] px-5 text-sm font-semibold text-[#002583] hover:bg-[#ffc733]">
          Continue Shopping <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat href="/customer/orders" icon={Package} label="Orders in progress" value={loading && !data ? "–" : active.length} />
        <Stat href="/cart" icon={ShoppingCart} label="Items in cart" value={mounted ? cartCount : 0} />
        <Stat href="/customer/saved" icon={Heart} label="Saved items" value={mounted ? savedCount : 0} />
        <Stat href="/customer/addresses" icon={MapPin} label="Addresses" value="Manage" />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold text-brand">Recent orders</h2>
          <Link href="/customer/orders" className="text-sm font-semibold text-brand hover:underline">View all</Link>
        </div>
        {loading && !data ? (
          <div className="space-y-2">{[0, 1].map((key) => <Skeleton key={key} className="h-14 w-full rounded-xl" />)}</div>
        ) : orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No orders yet. <Link href="/#products" className="font-semibold text-brand hover:underline">Start shopping</Link>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {orders.slice(0, 4).map((order) => (
              <li key={order.id}>
                <Link href={`/customer/orders/${order.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Order {orderNumber(order.id)} · {orderShopName(order)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                  </div>
                  <StatusBadge status={order.status} />
                  <span className="hidden text-sm font-bold text-brand sm:block">{formatKwacha(order.total)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/feed" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
        <Users className="h-5 w-5 text-brand" />
        <span className="flex-1 text-sm"><strong>Community Feed</strong> · See what local shops are posting</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}
