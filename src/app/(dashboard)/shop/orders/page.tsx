"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import ShopNav from "@/components/ShopNav";
import DeliveryTracker from "@/components/orders/DeliveryTracker";
import OrderLifecycle from "@/components/orders/OrderLifecycle";
import OrderPaymentBadge from "@/components/orders/OrderPaymentBadge";
import PickupJourney from "@/components/orders/PickupJourney";
import { Button } from "@/components/ui/button";
import { formatKwacha } from "@/lib/product";
import {
  canCancelOrder,
  canTrackCourier,
  nextShopStatus,
  normalizeOrderStatus,
  orderStatusHeaderClass,
  orderStatusLabel,
  orderStatusPillClass,
  shopActionLabel,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
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
    vehicle?: string;
    plate?: string;
    location?: { lat: number; lng: number; updatedAt?: string };
    trackingUrl?: string;
  };
  delivery?: {
    provider?: string;
    stage?: string;
    etaMinutes?: number;
    trackingUrl?: string;
    mock?: boolean;
    error?: string;
    externalId?: string;
    distanceKm?: number;
    pickup?: { lat: number; lng: number };
    dropoff?: { lat: number; lng: number };
  };
  escrow?: {
    status: "held" | "released" | "refunded" | "cash" | "none";
    amount: number;
    goodsAmount?: number;
    deliveryFee?: number;
    shopPayout?: number;
    courierPayout?: number;
  };
  customerLocation?: { lat: number; lng: number; updatedAt?: string };
  customerDistanceKm?: number;
  customerEtaMinutes?: number;
}

interface ShopDetails {
  name?: string;
  locationId?: string;
  coordinates?: { lat?: number; lng?: number };
}

function customerFields(customer: ShopOrder["customerId"]) {
  return typeof customer === "string"
    ? { id: customer, name: "Customer" }
    : {
        id: customer.id || "",
        name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer",
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
  const response = await fetch(`/api/orders?shopId=${encodeURIComponent(shopId)}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load orders");
  return data.orders || [];
}

export default function ShopOrdersPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [shopDetails, setShopDetails] = useState<ShopDetails>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let active = true;
    if (!user?.id) return;

    // The shop pin is what customers open in Google Maps for pickup orders.
    fetch(`/api/shops?id=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        const shop = data.shop || data.shops?.[0];
        if (active && shop) {
          setShopDetails({ name: shop.name, locationId: shop.locationId, coordinates: shop.coordinates });
        }
      })
      .catch(() => undefined);

    getShopOrders(user.id)
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load orders");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const refreshOrders = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      setOrders(await getShopOrders(user.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh orders");
    } finally {
      setRefreshing(false);
    }
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
      if (data.bookingError) {
        toast.error(`Order confirmed, but the courier could not be booked: ${data.bookingError}`, {
          id: "shop-order-update",
        });
      } else if (data.courier) {
        toast.success(
          `Order confirmed. ${data.courier.name} is heading to the shop${data.courier.mock ? " (sandbox courier)" : ""}.`,
          { id: "shop-order-update" }
        );
      } else if (doneMessage) {
        toast.success(doneMessage, { id: "shop-order-update" });
      }
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update order");
      return null;
    } finally {
      setBusyOrder(null);
    }
  };

  const retryCourierBooking = async (order: ShopOrder) => {
    setBusyOrder(order.id);
    setError("");
    try {
      const response = await fetch("/api/delivery/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not book the courier");
      if (user?.id) setOrders(await getShopOrders(user.id));
      toast.success(
        `${data.courier?.name || "A courier"} is heading to the shop${data.courier?.mock ? " (sandbox)" : ""}.`,
        { id: "shop-courier" }
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not book the courier");
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
      "Courier contact details saved"
    );
  };

  const copyTrackingLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Courier link copied — send it to the rider", { id: "tracking-link" });
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

  const statusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    const status = normalizeOrderStatus(order.status);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const filterOptions = [
    { value: "all", label: "All", count: orders.length },
    {
      value: "active",
      label: "Active",
      count: orders.filter((order) => !["completed", "cancelled"].includes(normalizeOrderStatus(order.status))).length,
    },
    ...ORDER_STATUSES.map((status) => ({
      value: status,
      label: ORDER_STATUS_LABELS[status],
      count: statusCounts[status] || 0,
    })),
  ];

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto max-w-6xl space-y-4 p-3 pb-24 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold"><Package className="h-5 w-5 text-brand" /> Orders</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Confirm, hand to the courier, and track every sale</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={refreshOrders}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}<span className="ml-1.5">Refresh</span>
          </Button>
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
            <p className="mt-1 text-sm text-muted-foreground">New customer orders will appear here.</p>
          </section>
        ) : filteredOrders.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">No orders match this filter.</section>
        ) : (
          filteredOrders.map((order) => {
            const customer = customerFields(order.customerId);
            const status = normalizeOrderStatus(order.status);
            const next = nextShopStatus(order.status, order.deliveryMethod);
            const isPickup = order.deliveryMethod === "pickup";
            const isYango = order.deliveryMethod === "yango";
            const showAgentForm = !isPickup && ["agent_assigned", "delivery_in_progress"].includes(status);
            const trackerVisible = !isPickup && canTrackCourier(order.status) && Boolean(order.delivery?.externalId);
            const canRetryBooking =
              isYango &&
              status === "approved" &&
              !order.delivery?.externalId &&
              ["quoted", "failed"].includes(order.delivery?.stage || "quoted");
            return (
              <article key={order.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <header className={`flex flex-wrap items-start justify-between gap-3 border-b p-4 ${orderStatusHeaderClass(order.status)}`}>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase opacity-70">Order ID</p>
                    <h2 className="break-all font-bold">#{order.id}</h2>
                    <p className="mt-1 text-xs opacity-70">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {trackerVisible && (
                      <DeliveryTracker
                        orderId={order.id}
                        status={order.status}
                        delivery={order.delivery}
                        agent={order.deliveryAgent}
                        dropoffAddress={order.deliveryAddress}
                        compact
                      />
                    )}
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${orderStatusPillClass(order.status)}`}>{orderStatusLabel(order.status, order.deliveryMethod)}</span>
                  </div>
                </header>

                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="space-y-3">
                    <OrderLifecycle status={order.status} deliveryMethod={order.deliveryMethod} className="pb-1" />

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
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderPaymentBadge escrow={order.escrow} paymentMethod={order.paymentMethod} />
                      {isYango && order.delivery?.mock && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                          Sandbox courier
                        </span>
                      )}
                      {order.delivery?.distanceKm ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                          <Truck className="h-3 w-3" /> {order.delivery.distanceKm} km route
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <p className="flex items-center gap-2 text-muted-foreground"><Truck className="h-4 w-4 text-brand" />{deliveryLabel[order.deliveryMethod || ""] || "Delivery details to be arranged"}</p>
                      <p className="flex items-center gap-2 text-muted-foreground"><Wallet className="h-4 w-4 text-brand" />{order.paymentMethod === "airtel_money" ? "Airtel Money · escrow" : "Cash on pickup"}</p>
                    </div>
                    {order.deliveryAddress && <p className="text-xs text-muted-foreground">Deliver to: {order.deliveryAddress}</p>}
                    {order.notes && <p className="text-xs text-muted-foreground">Note: {order.notes}</p>}

                    {isPickup && ["approved", "delivered"].includes(status) && (
                      <PickupJourney
                        orderId={order.id}
                        role="shop"
                        status={status}
                        shop={{
                          name: shopDetails.name || "Your shop",
                          locationId: shopDetails.locationId,
                          coordinates: shopDetails.coordinates,
                        }}
                        customerLocation={order.customerLocation}
                        customerDistanceKm={order.customerDistanceKm}
                        customerEtaMinutes={order.customerEtaMinutes}
                      />
                    )}
                  </div>

                  <aside className="space-y-3 rounded-lg bg-muted/40 p-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Items</span><span>{formatKwacha(order.subtotal ?? order.total)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>{order.deliveryFee ? formatKwacha(order.deliveryFee) : "Free"}</span></div>
                      <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span className="text-brand">{formatKwacha(order.total)}</span></div>
                    </div>

                    {order.delivery?.error && (
                      <p className="rounded-lg border border-destructive/25 bg-destructive/10 p-2 text-[11px] text-destructive">
                        Courier booking failed: {order.delivery.error}
                      </p>
                    )}

                    {next && (
                      <Button
                        type="button"
                        disabled={busyOrder === order.id}
                        className="w-full"
                        onClick={() =>
                          updateOrder(
                            order,
                            { status: next },
                            next === "delivered" && isPickup
                              ? "Goods handed over. Waiting for the customer to confirm."
                              : next === "delivery_in_progress"
                                ? "Order dispatched. The customer can follow the courier now."
                                : undefined
                          )
                        }
                      >
                        {busyOrder === order.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {shopActionLabel(next, order.deliveryMethod)}
                      </Button>
                    )}

                    {canRetryBooking && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={busyOrder === order.id}
                        onClick={() => retryCourierBooking(order)}
                      >
                        {busyOrder === order.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                        Book Yango courier
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
                        <p className="text-xs font-semibold">Courier contact</p>
                        <p className="text-[10px] text-muted-foreground">
                          {order.delivery?.externalId
                            ? "Booked through Yango. Override the contact here only if the rider calls from another number."
                            : "Add your own rider instead of Yango."}
                        </p>
                        <input
                          name="agentName"
                          defaultValue={order.deliveryAgent?.name || ""}
                          placeholder="Courier name"
                          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                        />
                        <input
                          name="agentPhone"
                          defaultValue={order.deliveryAgent?.phone || ""}
                          placeholder="Courier phone"
                          inputMode="tel"
                          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                        />
                        <Button type="submit" size="sm" variant="outline" className="w-full" disabled={busyOrder === order.id}>
                          Save courier
                        </Button>
                        {order.deliveryAgent?.trackingUrl && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => copyTrackingLink(order.deliveryAgent!.trackingUrl!)}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy rider location link
                          </Button>
                        )}
                        {order.delivery?.trackingUrl && !order.delivery.mock && (
                          <a
                            href={order.delivery.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-medium text-brand hover:bg-muted"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open Yango tracking
                          </a>
                        )}
                      </form>
                    )}

                    {canCancelOrder(order.status) && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyOrder === order.id}
                        className="w-full"
                        onClick={() => updateOrder(order, { status: "cancelled" }, "Order cancelled. The customer has been notified and any escrow refunded.")}
                      >
                        Cancel order
                      </Button>
                    )}
                    {status === "delivered" && (
                      <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                        {isPickup ? "Waiting for the customer to confirm the sale" : "Waiting for the customer to confirm receipt"}
                      </p>
                    )}
                    {status === "completed" && (
                      <p className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> Sale closed · stock updated
                      </p>
                    )}
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
