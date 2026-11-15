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

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] || "Order received";
}

export function sellerOrderStatuses(deliveryMethod?: string) {
  return deliveryMethod === "pickup"
    ? ["in_store", "ready_for_pickup", "cancelled"]
    : ["in_store", "out_for_delivery", "delivered", "cancelled"];
}

export function customerCanConfirmReceived(status: string) {
  return status === "delivered" || status === "ready_for_pickup";
}
