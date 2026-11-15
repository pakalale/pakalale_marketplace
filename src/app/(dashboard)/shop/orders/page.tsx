"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquare, Package, RefreshCw, Store, Truck, Wallet } from "lucide-react";
import ShopNav from "@/components/ShopNav";
import { Button } from "@/components/ui/button";
import { formatKwacha } from "@/lib/product";
import { orderStatusLabel } from "@/lib/orderStatus";
import { useAuthStore } from "@/store/authStore";

interface OrderLine {
  quantity: number;
  price: number;
  productId: string | { id?: string; name?: string };
}

interface ShopOrder {
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
  notes?: string;
  createdAt: string;
  customerId: string | { id?: string; firstName?: string; lastName?: string; email?: string };
}

function customerFields(customer: ShopOrder["customerId"]) {
  return typeof customer === "string" ? { id: customer, name: "Customer", phone: "" } : {
    id: customer.id || "", name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer", phone: customer.email || "",
  };
}

function itemName(item: OrderLine) {
  return typeof item.productId === "string" ? "Product" : item.productId.name || "Product";
}

function nextStatus(order: ShopOrder) {
  if (["order_received", "pending", "confirmed", "preparing"].includes(order.status)) return "in_store";
  if (order.status === "in_store") return order.deliveryMethod === "pickup" ? "ready_for_pickup" : "out_for_delivery";
  if (order.status === "out_for_delivery") return "delivered";
  return null;
}

const deliveryLabel: Record<string, string> = {
  yango: "Yango delivery",
  indrive: "inDrive delivery",
  pickup: "Pickup from shop",
};

async function getShopOrders(shopId: string): Promise<ShopOrder[]> {
  const response = await fetch(`/api/orders?shopId=${encodeURIComponent(shopId)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load orders");
  return data.orders || [];
}

export default function ShopOrdersPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    getShopOrders(user.id)
      .then((data) => { if (active) setOrders(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load orders"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const refreshOrders = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try { setOrders(await getShopOrders(user.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh orders"); }
    finally { setRefreshing(false); }
  };

  const updateStatus = async (order: ShopOrder, status: string) => {
    setBusyOrder(order.id);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update order");
      if (user?.id) setOrders(await getShopOrders(user.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update order");
    } finally {
      setBusyOrder(null);
    }
  };

  const messageCustomer = async (order: ShopOrder) => {
    const customer = customerFields(order.customerId);
    if (!user?.id || !customer.id) return;
    setBusyOrder(order.id);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "general", participants: [user.id, customer.id] }),
      });
      const data = await response.json();
      if (!response.ok || !data.chat?.id) throw new Error(data.error || "Could not open customer chat");
      router.push(`/shop/chat?chatId=${data.chat.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open customer chat");
    } finally {
      setBusyOrder(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto max-w-5xl space-y-4 p-3 pb-24 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold"><Package className="h-5 w-5 text-brand" /> Orders</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Manage fulfillment and contact customers</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={refreshOrders}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}<span className="ml-1.5">Refresh</span>
          </Button>
        </div>

        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
        ) : orders.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No orders yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">New customer orders will appear here.</p>
          </section>
        ) : (
          orders.map((order) => {
            const customer = customerFields(order.customerId);
            const next = nextStatus(order);
            return (
              <article key={order.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase text-muted-foreground">Order ID</p>
                    <h2 className="break-all font-bold">#{order.id}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-brand">{orderStatusLabel(order.status)}</span>
                </header>

                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2"><Store className="h-4 w-4 text-brand" /><div><p className="text-xs text-muted-foreground">Customer</p><p className="text-sm font-semibold">{customer.name}</p></div></div>
                      <Button type="button" size="sm" variant="outline" disabled={busyOrder === order.id} onClick={() => messageCustomer(order)}>
                        {busyOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />} Message
                      </Button>
                    </div>
                    {order.customerPhone && <p className="text-xs text-muted-foreground">Phone: {order.customerPhone}</p>}
                    <ul className="divide-y divide-border border-y border-border">
                      {order.items.map((line, index) => (
                        <li key={`${order.id}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <span className="min-w-0 truncate">{itemName(line)} <span className="text-muted-foreground">× {line.quantity}</span></span>
                          <span className="shrink-0 font-medium">{formatKwacha(line.price * line.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <p className="flex items-center gap-2 text-muted-foreground"><Truck className="h-4 w-4 text-brand" />{deliveryLabel[order.deliveryMethod || ""] || "Delivery details to be arranged"}</p>
                      <p className="flex items-center gap-2 text-muted-foreground"><Wallet className="h-4 w-4 text-brand" />{order.paymentMethod === "airtel_money" ? "Airtel Money" : order.paymentMethod === "cash" || order.paymentMethod === "Cash" ? "Cash at pickup" : order.paymentMethod || "Payment to be arranged"}</p>
                    </div>
                    {order.deliveryAddress && <p className="text-xs text-muted-foreground">Deliver to: {order.deliveryAddress}</p>}
                    {order.notes && <p className="text-xs text-muted-foreground">Note: {order.notes}</p>}
                  </div>

                  <aside className="space-y-3 rounded-lg bg-muted/40 p-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Items</span><span>{formatKwacha(order.subtotal ?? order.total)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>{order.deliveryFee ? formatKwacha(order.deliveryFee) : "Free"}</span></div>
                      <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span className="text-brand">{formatKwacha(order.total)}</span></div>
                    </div>
                    {next && (
                      <Button type="button" disabled={busyOrder === order.id} className="w-full" onClick={() => updateStatus(order, next)}>
                        {busyOrder === order.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {next === "in_store" ? "Confirm order" : next === "out_for_delivery" ? "Mark out for delivery" : next === "ready_for_pickup" ? "Mark ready for pickup" : "Mark delivered"}
                      </Button>
                    )}
                    {!["cancelled", "delivered", "received", "completed"].includes(order.status) && order.status !== "ready_for_pickup" && (
                      <Button type="button" variant="outline" disabled={busyOrder === order.id} className="w-full" onClick={() => updateStatus(order, "cancelled")}>Cancel order</Button>
                    )}
                    {order.status === "received" && <p className="flex items-center gap-2 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />Customer confirmed receipt</p>}
                  </aside>
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}