"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CheckCircle2, Copy, Loader2, MessageSquare, Package, RefreshCw, Store, Truck, Wallet } from "lucide-react";
import ShopNav from "@/components/ShopNav";
import DeliveryLocationButton from "@/components/orders/DeliveryLocationButton";
import { Button } from "@/components/ui/button";
import { formatKwacha } from "@/lib/product";
import {
  canCancelOrder,
  isOutForDelivery,
  nextShopStatus,
  normalizeOrderStatus,
  orderStatusHeaderClass,
  orderStatusLabel,
  orderStatusPillClass,
  shopActionLabel,
} from "@/lib/orderStatus";
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
  deliveryAgent?: {
    name?: string;
    phone?: string;
    location?: { lat: number; lng: number; updatedAt?: string };
    trackingUrl?: string;
  };
}

function customerFields(customer: ShopOrder["customerId"]) {
  return typeof customer === "string" ? { id: customer, name: "Customer", phone: "" } : {
    id: customer.id || "", name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer", phone: customer.email || "",
  };
}

function itemName(item: OrderLine) {
  return typeof item.productId === "string" ? "Product" : item.productId.name || "Product";
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
  const [statusFilter, setStatusFilter] = useState("all");

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

  const updateOrder = async (order: ShopOrder, payload: Record<string, unknown>, doneMessage?: string) => {
    setBusyOrder(order.id);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update order");
      if (user?.id) setOrders(await getShopOrders(user.id));
      if (doneMessage) toast.success(doneMessage, { id: "shop-order-update" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update order");
    } finally {
      setBusyOrder(null);
    }
  };

  const saveAgent = async (order: ShopOrder, form: HTMLFormElement) => {
    const data = new FormData(form);
    await updateOrder(
      order,
      {
        deliveryAgent: {
          name: String(data.get("agentName") || ""),
          phone: String(data.get("agentPhone") || ""),
        },
      },
      "Delivery agent details saved"
    );
  };

  const copyTrackingLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tracking link copied — send it to the delivery agent", { id: "tracking-link" });
    } catch {
      toast.error("Could not copy the link. Long-press it instead.", { id: "tracking-link" });
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

  const filteredOrders = orders.filter((order) => {
    const status = normalizeOrderStatus(order.status);
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return !["completed", "cancelled"].includes(status);
    return status === statusFilter;
  });

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

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="shop-order-filter" className="text-sm font-medium">Filter orders</label>
          <select id="shop-order-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 min-w-48 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="all">All orders</option>
            <option value="active">Needs action</option>
            <option value="order_placed">Order placed</option>
            <option value="approved">Approved</option>
            <option value="delivery_in_progress">Delivery in progress</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
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
            <p className="mt-1 text-sm text-muted-foreground">New customer orders will appear here.</p>
          </section>
        ) : (
          filteredOrders.length === 0 ? (
            <section className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">No orders match this filter.</section>
          ) : filteredOrders.map((order) => {
            const customer = customerFields(order.customerId);
            const status = normalizeOrderStatus(order.status);
            const next = nextShopStatus(order.status);
            const isPickup = order.deliveryMethod === "pickup";
            const showAgentForm = !isPickup && ["approved", "delivery_in_progress"].includes(status);
            return (
              <article key={order.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <header className={`flex flex-wrap items-start justify-between gap-3 border-b p-4 ${orderStatusHeaderClass(order.status)}`}>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase opacity-70">Order ID</p>
                    <h2 className="break-all font-bold">#{order.id}</h2>
                    <p className="mt-1 text-xs opacity-70">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOutForDelivery(order.status) && (
                      <DeliveryLocationButton orderId={order.id} agent={order.deliveryAgent} compact />
                    )}
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${orderStatusPillClass(order.status)}`}>{orderStatusLabel(order.status, order.deliveryMethod)}</span>
                  </div>
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
                      <Button type="button" disabled={busyOrder === order.id} className="w-full" onClick={() => updateOrder(order, { status: next })}>
                        {busyOrder === order.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {shopActionLabel(next, order.deliveryMethod)}
                      </Button>
                    )}

                    {showAgentForm && (
                      <form
                        className="space-y-2 rounded-lg border border-border bg-background p-2.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveAgent(order, event.currentTarget);
                        }}
                      >
                        <p className="text-xs font-semibold">Delivery agent</p>
                        <input
                          name="agentName"
                          defaultValue={order.deliveryAgent?.name || ""}
                          placeholder="Agent name"
                          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                        />
                        <input
                          name="agentPhone"
                          defaultValue={order.deliveryAgent?.phone || ""}
                          placeholder="Agent phone"
                          inputMode="tel"
                          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                        />
                        <Button type="submit" size="sm" variant="outline" className="w-full" disabled={busyOrder === order.id}>
                          Save agent
                        </Button>
                        {order.deliveryAgent?.trackingUrl && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => copyTrackingLink(order.deliveryAgent!.trackingUrl!)}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy tracking link
                          </Button>
                        )}
                      </form>
                    )}

                    {canCancelOrder(order.status) && (
                      <Button type="button" variant="outline" disabled={busyOrder === order.id} className="w-full" onClick={() => updateOrder(order, { status: "cancelled" }, "Order cancelled. The customer has been notified.")}>Cancel order</Button>
                    )}
                    {status === "delivered" && <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Waiting for the customer to confirm</p>}
                    {status === "completed" && <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Sale recorded · stock updated</p>}
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
