"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquare, Package, Store, Truck, Wallet } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { formatKwacha } from "@/lib/product";
import { customerCanConfirmReceived, orderStatusLabel } from "@/lib/orderStatus";
import { useAuthStore } from "@/store/authStore";

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
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return !["received", "completed", "cancelled"].includes(order.status);
    if (statusFilter === "in_store") return ["in_store", "confirmed", "preparing"].includes(order.status);
    if (statusFilter === "delivered") return ["delivered", "received", "completed"].includes(order.status);
    return order.status === statusFilter;
  });

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

  const confirmReceived = async (order: CustomerOrder) => {
    setBusyOrder(order.id);
    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status: "received" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not confirm receipt");
      await loadOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm receipt");
    } finally {
      setBusyOrder(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header activeTab="orders" />
      <main className="mx-auto max-w-2xl space-y-4 p-3 pb-24 sm:p-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold"><Package className="h-5 w-5 text-brand" /> My Orders</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Order progress and shop contact details</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="customer-order-filter" className="text-sm font-medium">Filter orders</label>
          <select id="customer-order-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 min-w-48 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="all">All orders</option>
            <option value="active">Active orders</option>
            <option value="order_received">Order received</option>
            <option value="in_store">In store</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="ready_for_pickup">Ready for pickup</option>
            <option value="delivered">Delivered / received</option>
            <option value="cancelled">Cancelled</option>
          </select>
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
            const canConfirm = customerCanConfirmReceived(order.status);
            return (
              <article key={order.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase text-muted-foreground">Order ID</p>
                    <h2 className="break-all font-bold">#{order.id}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full {orderStatusColorClass(order.status)} px-3 py-1.5 text-xs font-semibold text-foreground">
                    {orderStatusLabel(order.status)}
                  </span>
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
                    <Button type="button" className="w-full" disabled={busyOrder === order.id} onClick={() => confirmReceived(order)}>
                      {busyOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Confirm received
                    </Button>
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