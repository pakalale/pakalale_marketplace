export const ORDER_STATUS_LABELS: Record<string, string> = {
  order_received: "Order received",
  in_store: "In store",
  out_for_delivery: "Out for delivery",
  ready_for_pickup: "Ready for pickup",
  delivered: "Delivered",
  received: "Received",
  cancelled: "Cancelled",
  pending: "Order received",
  confirmed: "In store",
  preparing: "In store",
  ready: "Ready for pickup",
  completed: "Received",
};

// Color mapping for order statuses
// Green: completed/delivered, Red: cancelled, Amber: in progress, Blue: pending action
export const ORDER_STATUS_COLORS: Record<string, string> = {
  // Green - complete
  delivered: "bg-emerald-100 text-emerald-800",
  received: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  // Red - cancelled
  cancelled: "bg-red-100 text-red-800",
  // Amber/Orange - in progress
  in_store: "bg-amber-100 text-amber-800",
  confirmed: "bg-amber-100 text-amber-800",
  preparing: "bg-amber-100 text-amber-800",
  out_for_delivery: "bg-amber-100 text-amber-800",
  ready_for_pickup: "bg-amber-100 text-amber-800",
  // Blue - pending action
  order_received: "bg-blue-100 text-blue-800",
  pending: "bg-blue-100 text-blue-800",
  // Default gray for others
  default: "bg-muted/30 text-foreground",
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] || "Order received";
}

export function orderStatusColorClass(status: string) {
  return ORDER_STATUS_COLORS[status] || ORDER_STATUS_COLORS.default;
}

export function sellerOrderStatuses(deliveryMethod?: string) {
  return deliveryMethod === "pickup"
    ? ["in_store", "ready_for_pickup", "cancelled"]
    : ["in_store", "out_for_delivery", "delivered", "cancelled"];
}

export function customerCanConfirmReceived(status: string) {
  return status === "delivered" || status === "ready_for_pickup";
}
