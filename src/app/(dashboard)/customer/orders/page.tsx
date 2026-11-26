"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CheckCircle2, Loader2, MessageSquare, Package, Star, Store, Truck, Wallet, X } from "lucide-react";
import Header from "@/components/Header";
import DeliveryLocationButton from "@/components/orders/DeliveryLocationButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatKwacha } from "@/lib/product";
import {
  canCancelOrder,
  customerCanConfirmCompletion,
  isOutForDelivery,
  normalizeOrderStatus,
  orderStatusHeaderClass,
  orderStatusLabel,
  orderStatusPillClass,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const STARS = [5, 4, 3, 2, 1];

interface OrderLine {
  quantity: number;
  price: number;
  productId: string | { id?: string; name?: string; images?: string[] };
}

interface CustomerOrder {
  id: string;
  status: string;
  items: OrderLine[];
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod?: string;
  deliveryMethod?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  createdAt: string;
  shopId: string | { id?: string; name?: string; ownerId?: string; profileImage?: string };
  deliveryAgent?: {
    name?: string;
    phone?: string;
    location?: { lat: number; lng: number; updatedAt?: string };
  };
}

const deliveryLabel: Record<string, string> = {
  yango: "Yango delivery",
  indrive: "inDrive delivery",
  pickup: "Pickup from shop",
};

function shopFields(shop: CustomerOrder["shopId"]) {
  return typeof shop === "string" ? { id: shop, name: "Shop", ownerId: "", profileImage: "" } : {
    id: shop.id || "", name: shop.name || "Shop", ownerId: shop.ownerId || "", profileImage: shop.profileImage || "",
  };
}

function productName(line: OrderLine) {
  return typeof line.productId === "string" ? "Product" : line.productId.name || "Product";
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviews, setReviews] = useState<Record<string, { rating: number; comment: string }>>({});
  const [submittingReview, setSubmittingReview] = useState<string | null>(null);

  const loadOrders = async () => {
    setError("");
    const response = await fetch("/api/orders");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load orders");
    setOrders(data.orders || []);
  };

  useEffect(() => {
    let active = true;
    fetch("/api/orders")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load orders");
        if (active) setOrders(data.orders || []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load orders");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredOrders = orders.filter((order) => {
    const status = normalizeOrderStatus(order.status);
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return !["completed", "cancelled"].includes(status);
    return status === statusFilter;
  });

  const statusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    const status = normalizeOrderStatus(order.status);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const filterOptions = [
    { value: "all", label: "Active", count: orders.filter((order) => !["completed", "cancelled"].includes(normalizeOrderStatus(order.status))).length },
    { value: "active", label: "Active", count: orders.filter((order) => !["completed", "cancelled"].includes(normalizeOrderStatus(order.status))).length },
    ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status], count: statusCounts[status] || 0 })),
  ];

  const messageShop = async (order: CustomerOrder) => {
    const shop = shopFields(order.shopId);
    if (!user?.id || !shop.ownerId) return;
    setBusyOrder(order.id);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "general", participants: [user.id, shop.ownerId] }),
      });
      const data = await response.json();
      if (!response.ok || !data.chat?.id) throw new Error(data.error || "Could not open shop chat");
      router.push(`/customer/chat?chatId=${data.chat.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open shop chat");
    } finally {
      setBusyOrder(null);
    }
  };

  const updateStatus = async (order: CustomerOrder, status: "completed" | "cancelled") => {
    setBusyOrder(order.id);
    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update this order");
      await loadOrders();
      if (status === "cancelled") {
        toast.success("Order cancelled. The shop has been notified.", { id: "customer-order-update" });
      } else {
        toast.success("Order completed. Thanks for confirming!", { id: "customer-order-update" });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this order");
    } finally {
      setBusyOrder(null);
    }
  };

  const submitReview = async (order: CustomerOrder, rating: number, comment: string) => {
    if (!user?.id) return;
    setSubmittingReview(order.id);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: user.id,
          shopId: typeof order.shopId === "string" ? order.shopId : order.shopId.id,
          orderId: order.id,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit review");
      setReviews((prev) => ({ ...prev, [order.id]: { rating, comment } }));
      toast.success("Review submitted. Thanks for your feedback!", { id: "customer-review" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit review");
    } finally {
      setSubmittingReview(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header activeTab="orders" />
      <main className="mx-auto max-w-4xl space-y-4 p-3 pb-24 sm:p-5">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold"><Package className="h-5 w-5 text-brand" /> My Orders</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Order progress and shop contact details</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Filter orders</p>
          <div
            role="group"
            aria-label="Filter orders by status"
            className="-mx-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max gap-2">
              {filterOptions.map((option) => {
                const active = statusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active ? "border-brand bg-brand/10 text-brand" : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none", active ? "bg-brand text-primary-foreground" : "bg-muted text-foreground")}>
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
        ) : orders.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No orders yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your placed orders will appear here.</p>
            <Button className="mt-4" onClick={() => router.push("/customer/locations")}>Browse shops</Button>
          </section>
        ) : (
          filteredOrders.length === 0 ? (
            <section className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">No orders match this filter.</section>
          ) : filteredOrders.map((order) => {
            const shop = shopFields(order.shopId);
            const canConfirm = customerCanConfirmCompletion(order.status);
            const canCancel = canCancelOrder(order.status);
            const trackable = isOutForDelivery(order.status) && order.deliveryMethod !== "pickup";
            return (
              <article key={order.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className={`flex flex-wrap items-start justify-between gap-3 border-b p-4 ${orderStatusHeaderClass(order.status)}`}>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase opacity-70">Order ID</p>
                    <h2 className="break-all font-bold">#{order.id}</h2>
                    <p className="mt-1 text-xs opacity-70">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {trackable && (
                      <DeliveryLocationButton orderId={order.id} agent={order.deliveryAgent} compact />
                    )}
                    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${orderStatusPillClass(order.status)}`}>
                      {orderStatusLabel(order.status, order.deliveryMethod)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {shop.profileImage ? <Image src={shop.profileImage} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand"><Store className="h-4 w-4" /></span>}
                      <div className="min-w-0"><p className="text-xs text-muted-foreground">Shop</p><p className="truncate text-sm font-semibold">{shop.name}</p></div>
                    </div>
                    <Button type="button" size="sm" variant="outline" disabled={!shop.ownerId || busyOrder === order.id} onClick={() => messageShop(order)}>
                      {busyOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />} Message shop
                    </Button>
                  </div>

                  <ul className="divide-y divide-border border-y border-border">
                    {order.items.map((line, index) => (
                      <li key={`${order.id}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="min-w-0 truncate">{productName(line)} <span className="text-muted-foreground">× {line.quantity}</span></span>
                        <span className="shrink-0 font-medium">{formatKwacha(line.price * line.quantity)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <p className="flex items-center gap-2 text-muted-foreground"><Truck className="h-4 w-4 text-brand" />{deliveryLabel[order.deliveryMethod || ""] || "Delivery details to be arranged"}</p>
                    <p className="flex items-center gap-2 text-muted-foreground"><Wallet className="h-4 w-4 text-brand" />{order.paymentMethod === "airtel_money" ? "Airtel Money" : order.paymentMethod === "cash" || order.paymentMethod === "Cash" ? "Cash at pickup" : order.paymentMethod || "Payment to be arranged"}</p>
                  </div>
                  {order.customerPhone && <p className="text-xs text-muted-foreground">Contact: {order.customerPhone}</p>}
                  {order.deliveryAddress && <p className="text-xs text-muted-foreground">Delivery address: {order.deliveryAddress}</p>}

                  <div className="space-y-1 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Items</span><span>{formatKwacha(order.subtotal ?? order.total)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>{order.deliveryFee ? formatKwacha(order.deliveryFee) : "Free"}</span></div>
                    <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span className="text-brand">{formatKwacha(order.total)}</span></div>
                  </div>
                  {canConfirm && (
                    <Button type="button" className="w-full" disabled={busyOrder === order.id} onClick={() => updateStatus(order, "completed")}>
                      {busyOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Confirm order completed
                    </Button>
                  )}
                  {canCancel && (
                    <Button type="button" variant="outline" className="w-full" disabled={busyOrder === order.id} onClick={() => updateStatus(order, "cancelled")}>
                      Cancel order
                    </Button>
                  )}
                  {normalizeOrderStatus(order.status) === "completed" && !reviews[order.id] && (
                    <div className="border-t border-border pt-3 mt-1">
                      <p className="text-xs font-medium mb-2">How was your order?</p>
                      <div className="flex gap-1 mb-2">
                        {STARS.map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="p-1 transition-colors"
                            onClick={() => setReviews((prev) => ({ ...prev, [order.id]: { rating: star, comment: prev[order.id]?.comment || "" } }))}
                          >
                            <Star className={`h-5 w-5 ${star <= (reviews[order.id]?.rating || 0) ? "text-yellow-400 fill-yellow-400" : "text-muted"}`} />
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={reviews[order.id]?.comment || ""}
                        onChange={(e) => setReviews((prev) => ({ ...prev, [order.id]: { ...prev[order.id], comment: e.target.value } }))}
                        placeholder="Write a short review (optional)..."
                        className="text-xs h-16 resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 text-xs"
                          disabled={submittingReview === order.id || (!reviews[order.id]?.rating && !reviews[order.id]?.comment)}
                          onClick={() => {
                            const r = reviews[order.id];
                            if (r) submitReview(order, r.rating, r.comment);
                          }}
                        >
                          {submittingReview === order.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                          Submit review
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => {
                            const next = { ...reviews };
                            delete next[order.id];
                            setReviews(next);
                          }}
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  )}
                  {reviews[order.id] && normalizeOrderStatus(order.status) === "completed" && (
                    <div className="border-t border-border pt-2">
                      <div className="flex items-center gap-1 text-xs">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3.5 w-3.5 ${s <= reviews[order.id]!.rating ? "text-yellow-400 fill-yellow-400" : "text-muted"}`} />
                        ))}
                        {reviews[order.id]!.comment && <span className="text-muted-foreground ml-1">— {reviews[order.id]!.comment}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}