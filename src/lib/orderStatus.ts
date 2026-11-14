import type { OrderData } from "@/hooks/useApi";
import { deliveryOption } from "@/lib/delivery";

type Status = OrderData["status"];

/** The path an order normally takes, in order. */
export const ORDER_STEPS: Array<{ status: Status; label: string }> = [
  { status: "pending", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "completed", label: "Completed" },
];

export const STATUS_STYLES: Record<Status, { label: string; className: string }> = {
  pending: { label: "Placed", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  confirmed: { label: "Confirmed", className: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  preparing: { label: "Preparing", className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  ready: { label: "Ready", className: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
};

export const orderNumber = (id: string) => `#${id.slice(-6).toUpperCase()}`;

export function orderShopName(order: OrderData) {
  return typeof order.shopId === "object" ? order.shopId.name : "Shop";
}

export function orderDeliveryLabel(order: OrderData) {
  return deliveryOption(order.deliveryMethod)?.label ?? "Arranged with the shop";
}

/** Older orders have no subtotal: their total is items only. */
export function orderSubtotal(order: OrderData) {
  return order.subtotal ?? order.total - (order.deliveryFee ?? 0);
}
