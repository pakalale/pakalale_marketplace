"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, MapPin, Package, Phone, Store, Truck, XCircle } from "lucide-react";
import StatusBadge from "@/components/account/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/hooks/useApi";
import { ORDER_STEPS, orderDeliveryLabel, orderNumber, orderShopName, orderSubtotal } from "@/lib/orderStatus";
import { formatKwacha } from "@/lib/product";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border border-border bg-card p-4 sm:p-5";

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data, loading } = useOrders({ id: orderId });
  const order = data?.orders?.[0];

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <Package className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">We couldn&apos;t find this order</p>
        <Link href="/customer/orders" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>
      </div>
    );
  }

  const stepIndex = ORDER_STEPS.findIndex((step) => step.status === order.status);
  const fee = order.deliveryFee ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-brand">
            Order {orderNumber(order.id)} <StatusBadge status={order.status} />
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Placed {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <Link href="/customer/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <ArrowLeft className="h-4 w-4" /> All orders
        </Link>
      </div>

      <section className={card} aria-label="Order progress">
        {order.status === "cancelled" ? (
          <p className="flex items-center gap-2 font-semibold text-destructive"><XCircle className="h-5 w-5" /> This order was cancelled.</p>
        ) : (
          <ol className="grid grid-cols-5 gap-1">
            {ORDER_STEPS.map((step, index) => {
              const done = index <= stepIndex;
              return (
                <li key={step.status} className="flex flex-col items-center gap-1.5 text-center">
                  <div className="flex w-full items-center">
                    <span className={cn("h-0.5 flex-1", index === 0 ? "invisible" : done ? "bg-brand" : "bg-border")} />
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2", done ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card text-muted-foreground")}>
                      {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                    </span>
                    <span className={cn("h-0.5 flex-1", index === ORDER_STEPS.length - 1 ? "invisible" : index < stepIndex ? "bg-brand" : "bg-border")} />
                  </div>
                  <span className={cn("text-[11px] font-medium sm:text-xs", done ? "text-brand" : "text-muted-foreground")}>{step.label}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={card}>
          <h2 className="flex items-center gap-2 font-semibold"><Store className="h-4 w-4 text-brand" /> {orderShopName(order)}</h2>
          <ul className="mt-3 divide-y divide-border">
            {order.items.map((item, index) => {
              const product = typeof item.productId === "object" ? item.productId : null;
              const image = product?.images?.find((url) => !/\/video\//.test(url));
              return (
                <li key={index} className="flex items-center gap-3 py-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{product?.name || "Product"}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} × {formatKwacha(item.price)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold">{formatKwacha(item.price * item.quantity)}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-4">
          <section className={cn(card, "space-y-2 text-sm")}>
            <h2 className="font-semibold">Delivery</h2>
            <p className="flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /> {orderDeliveryLabel(order)}</p>
            {order.deliveryAddress && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {order.deliveryAddress}</p>}
            {order.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand" /> {order.phone}</p>}
            <p className="text-xs text-muted-foreground">Payment: {order.paymentMethod || "Cash"}</p>
          </section>

          <section className={cn(card, "space-y-1.5 text-sm")}>
            <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatKwacha(orderSubtotal(order))}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span className="font-semibold">{fee === 0 ? "Free" : formatKwacha(fee)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <span className="font-bold text-brand">Total</span>
              <span className="font-bold text-brand">{formatKwacha(order.total)}</span>
            </div>
          </section>

          <Link href="/" className="flex h-11 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
