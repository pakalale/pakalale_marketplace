/**
 * Delivery choices offered at checkout. The server charges these fees, so
 * change prices here and both the cart panel and the order total follow.
 * Each shop ships its own order, so the fee applies once per shop.
 */
export const DELIVERY_OPTIONS = [
  { id: "yango", label: "Yango", eta: "2–3 days", fee: 60, needsAddress: true },
  { id: "indrive", label: "inDrive", eta: "2–3 days", fee: 60, needsAddress: true },
  { id: "pickup", label: "Pickup from store", eta: "When the shop confirms", fee: 0, needsAddress: false },
] as const;

export type DeliveryId = (typeof DELIVERY_OPTIONS)[number]["id"];
export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];

export const DEFAULT_DELIVERY: DeliveryId = "yango";

export function deliveryOption(id: unknown): DeliveryOption | undefined {
  return DELIVERY_OPTIONS.find((option) => option.id === id);
}

/** Delivery cost for a cart that spans `shopCount` shops. */
export function deliveryTotal(id: DeliveryId, shopCount: number) {
  return (deliveryOption(id)?.fee ?? 0) * shopCount;
}
