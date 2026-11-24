/**
 * The order lifecycle, in one place.
 *
 *   order_placed  → the customer checked out; both shop and customer are notified
 *   approved      → the shop confirmed the order; goods are still in the store
 *   delivery_in_progress → handover to the delivery agent (pickup: ready for pickup)
 *   delivered     → the delivery agent marked it delivered
 *   completed     → the customer confirmed receipt; the sale is recorded and stock drops
 *   cancelled     → either side backed out before delivery
 */
export const ORDER_STATUSES = [
  "order_placed",
  "approved",
  "delivery_in_progress",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  order_placed: "Order placed",
  approved: "Approved",
  delivery_in_progress: "Delivery in progress",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PICKUP_LABELS: Partial<Record<OrderStatus, string>> = {
  delivery_in_progress: "Ready for pickup",
  delivered: "Picked up",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Orders created before this flow used a dozen different statuses. Map them onto
 * the six we use now so old orders keep their meaning instead of rendering as
 * "Order placed".
 */
const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  order_received: "order_placed",
  pending: "order_placed",
  new: "order_placed",
  in_store: "approved",
  confirmed: "approved",
  preparing: "approved",
  out_for_delivery: "delivery_in_progress",
  ready_for_pickup: "delivery_in_progress",
  ready: "delivery_in_progress",
  delivered: "delivered",
  received: "completed",
  completed: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

export function normalizeOrderStatus(status: unknown): OrderStatus {
  if (isOrderStatus(status)) return status;
  if (typeof status === "string") return LEGACY_STATUS_MAP[status] ?? "order_placed";
  return "order_placed";
}

export function orderStatusLabel(status: string, deliveryMethod?: string) {
  const normalized = normalizeOrderStatus(status);
  if (deliveryMethod === "pickup" && PICKUP_LABELS[normalized]) {
    return PICKUP_LABELS[normalized] as string;
  }
  return ORDER_STATUS_LABELS[normalized];
}

// Colour + badge styling, derived from a small set of tones so the header band,
// the pill and any future chip always agree.
export type OrderStatusTone = "success" | "danger" | "progress" | "pending" | "neutral";

const STATUS_TONES: Record<OrderStatus, OrderStatusTone> = {
  order_placed: "pending",
  approved: "progress",
  delivery_in_progress: "progress",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
};

const TONE_STYLES: Record<OrderStatusTone, { soft: string; pill: string; header: string; dot: string }> = {
  success: {
    soft: "bg-emerald-100 text-emerald-800",
    pill: "bg-emerald-600 text-white",
    header: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  danger: {
    soft: "bg-red-100 text-red-800",
    pill: "bg-red-600 text-white",
    header: "border-red-200 bg-red-50 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
    dot: "bg-red-500",
  },
  progress: {
    soft: "bg-amber-100 text-amber-800",
    pill: "bg-amber-500 text-amber-950",
    header: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    dot: "bg-amber-500",
  },
  pending: {
    soft: "bg-blue-100 text-blue-800",
    pill: "bg-blue-600 text-white",
    header: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100",
    dot: "bg-blue-500",
  },
  neutral: {
    soft: "bg-muted text-muted-foreground",
    pill: "bg-muted text-foreground",
    header: "border-border bg-muted/40 text-foreground",
    dot: "bg-muted-foreground",
  },
};

export function orderStatusTone(status: string): OrderStatusTone {
  return STATUS_TONES[normalizeOrderStatus(status)] ?? "neutral";
}

/** Soft badge on a plain card background. */
export function orderStatusColorClass(status: string) {
  return TONE_STYLES[orderStatusTone(status)].soft;
}

/** Solid badge, readable on the tinted card header. */
export function orderStatusPillClass(status: string) {
  return TONE_STYLES[orderStatusTone(status)].pill;
}

/** Tinted band for the top of an order card (id, date, status). */
export function orderStatusHeaderClass(status: string) {
  return TONE_STYLES[orderStatusTone(status)].header;
}

/** Dot that carries the status colour wherever a badge is too heavy. */
export function orderStatusDotClass(status: string) {
  return TONE_STYLES[orderStatusTone(status)].dot;
}

/** Statuses the shop can move to next. One step at a time, never backwards. */
export function nextShopStatus(status: string): OrderStatus | null {
  switch (normalizeOrderStatus(status)) {
    case "order_placed":
      return "approved";
    case "approved":
      return "delivery_in_progress";
    case "delivery_in_progress":
      return "delivered";
    default:
      return null;
  }
}

/** Wording for the shop's action button that moves the order to `next`. */
export function shopActionLabel(next: OrderStatus, deliveryMethod?: string) {
  if (next === "approved") return "Approve order";
  if (next === "delivery_in_progress") {
    return deliveryMethod === "pickup" ? "Mark ready for pickup" : "Start delivery";
  }
  if (next === "delivered") return deliveryMethod === "pickup" ? "Mark picked up" : "Mark delivered";
  return "Update order";
}

/** The customer's last step: confirm the delivered order to complete it. */
export function customerCanConfirmCompletion(status: string) {
  return normalizeOrderStatus(status) === "delivered";
}

/** Both sides may back out until the goods are delivered. */
export function canCancelOrder(status: string) {
  return ["order_placed", "approved", "delivery_in_progress"].includes(normalizeOrderStatus(status));
}

/** True while the order still needs someone to act on it. */
export function isActiveOrderStatus(status: string) {
  return !["completed", "cancelled"].includes(normalizeOrderStatus(status));
}

/** Orders shown under the customer's "In delivery" shortcut. */
export function isOutForDelivery(status: string) {
  return normalizeOrderStatus(status) === "delivery_in_progress";
}
