/**
 * The order lifecycle, in one place.
 *
 *   order_placed  → the customer checked out; both shop and customer are notified
 *   approved      → the shop confirmed the order. For delivery this books the
 *                   courier; for pickup the goods are ready to collect
 *   agent_assigned → Yango found a courier, who is on the way to the shop
 *                   (pickup orders skip this step)
 *   delivery_in_progress → the shop handed the parcel to the courier and it is
 *                   now on the way to the customer
 *   delivered     → the courier completed the trip (pickup: handed over at shop)
 *   completed     → the customer confirmed receipt; escrow is released and the
 *                   sale is recorded
 *   cancelled     → either side backed out before delivery
 */
export const ORDER_STATUSES = [
  "order_placed",
  "approved",
  "agent_assigned",
  "delivery_in_progress",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  order_placed: "Awaiting shop",
  approved: "Shop confirmed",
  agent_assigned: "Courier assigned",
  delivery_in_progress: "Dispatched",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PICKUP_LABELS: Partial<Record<OrderStatus, string>> = {
  approved: "Ready for pickup",
  delivered: "Handed over",
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
  agent_assigned: "progress",
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

/**
 * Statuses the shop can move to next. One step at a time, never backwards.
 * Delivery orders are booked automatically on approval (→ agent_assigned), so
 * `approved → delivery_in_progress` is the manual fallback when a shop hands
 * the parcel to a courier outside Yango.
 */
export function nextShopStatus(status: string, deliveryMethod?: string): OrderStatus | null {
  switch (normalizeOrderStatus(status)) {
    case "order_placed":
      return "approved";
    case "approved":
      return deliveryMethod === "pickup" ? "delivered" : "delivery_in_progress";
    case "agent_assigned":
      return "delivery_in_progress";
    case "delivery_in_progress":
      return "delivered";
    default:
      return null;
  }
}

/** Wording for the shop's action button that moves the order to `next`. */
export function shopActionLabel(next: OrderStatus, deliveryMethod?: string) {
  if (next === "approved") return "Confirm order";
  if (next === "delivery_in_progress") {
    if (deliveryMethod === "pickup") return "Mark ready for pickup";
    return "Hand to courier";
  }
  if (next === "delivered") return deliveryMethod === "pickup" ? "Hand over goods" : "Mark delivered";
  if (next === "agent_assigned") return "Courier assigned";
  return "Update order";
}

/** The customer's last step: confirm the delivered order to complete it. */
export function customerCanConfirmCompletion(status: string) {
  return normalizeOrderStatus(status) === "delivered";
}

/** Both sides may back out until the goods are delivered. */
export function canCancelOrder(status: string) {
  return ["order_placed", "approved", "agent_assigned", "delivery_in_progress"].includes(
    normalizeOrderStatus(status)
  );
}

/** True while the order still needs someone to act on it. */
export function isActiveOrderStatus(status: string) {
  return !["completed", "cancelled"].includes(normalizeOrderStatus(status));
}

/** Orders shown under the customer's "In delivery" shortcut. */
export function isOutForDelivery(status: string) {
  return normalizeOrderStatus(status) === "delivery_in_progress";
}

/** True once a courier is booked, including while they ride to the shop. */
export function isCourierActive(status: string) {
  return ["agent_assigned", "delivery_in_progress"].includes(normalizeOrderStatus(status));
}

/** True when the customer can watch the courier (booked or en route). */
export function canTrackCourier(status: string) {
  return ["agent_assigned", "delivery_in_progress", "delivered"].includes(
    normalizeOrderStatus(status)
  );
}

export interface LifecycleStep {
  status: OrderStatus;
  label: string;
  detail?: string;
}

/**
 * The ordered timeline the order cards render. Delivery and pickup diverge at
 * the shop-confirmation step, so the method decides the middle stages.
 */
export function orderLifecycleSteps(deliveryMethod?: string): LifecycleStep[] {
  if (deliveryMethod === "pickup") {
    return [
      { status: "order_placed", label: "Order placed" },
      { status: "approved", label: "Shop confirmed", detail: "Ready for pickup" },
      { status: "delivered", label: "Handed over" },
      { status: "completed", label: "Sale closed" },
    ];
  }
  return [
    { status: "order_placed", label: "Order placed" },
    { status: "approved", label: "Shop confirmed" },
    { status: "agent_assigned", label: "Courier assigned" },
    { status: "delivery_in_progress", label: "Dispatched" },
    { status: "delivered", label: "Delivered" },
    { status: "completed", label: "Confirmed" },
  ];
}
