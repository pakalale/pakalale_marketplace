/**
 * Shared shapes for the delivery partners Pakalale hands orders to.
 *
 * Only Yango has a documented public API today. inDrive is kept in the type so
 * the rest of the app never has to special-case it, but its provider module is
 * still a placeholder.
 */

export type DeliveryProviderId = "yango" | "indrive";

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Provider-neutral stages. Yango calls these `performer_lookup`,
 * `performer_found`, `pickuped`, `delivered`…; we map them onto the small set
 * the order screen understands.
 */
export type DeliveryStage =
  | "quoted"
  | "booked"
  | "performer_found"
  | "pickup_arrived"
  | "picked_up"
  | "delivery_arrived"
  | "delivered"
  | "cancelled"
  | "failed";

export interface DeliveryAgentInfo {
  name: string;
  phone: string;
  vehicle?: string;
  plate?: string;
  rating?: number;
}

export interface DeliveryQuote {
  quoteId: string;
  shopId: string;
  provider: DeliveryProviderId;
  fee: number;
  currency: "ZMW";
  distanceKm: number;
  etaMinutes: number;
  expiresAt: string;
  mock: boolean;
}

export interface DeliveryBookingInput {
  orderId: string;
  provider: DeliveryProviderId;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  pickupAddress: string;
  dropoffAddress: string;
  customerName: string;
  customerPhone: string;
  shopName: string;
  shopPhone?: string;
  note?: string;
}

export interface DeliveryBooking {
  externalId: string;
  provider: DeliveryProviderId;
  stage: DeliveryStage;
  agent: DeliveryAgentInfo;
  /** Public tracking page from the provider (e.g. the Yango app link). */
  trackingUrl?: string;
  etaMinutes: number;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  mock: boolean;
}

/**
 * What the provider knows about a booking right now. `orderStatus` is the
 * Pakalale status the snapshot was taken for; the mock provider uses it to
 * decide which leg of the journey to simulate.
 */
export interface DeliverySnapshotInput {
  orderId: string;
  status: "approved" | "agent_assigned" | "delivery_in_progress" | "delivered" | "completed" | "cancelled";
  externalId?: string;
  bookedAt?: Date;
  dispatchedAt?: Date;
  pickup: GeoPoint;
  dropoff: GeoPoint;
}

export interface DeliverySnapshot {
  stage: DeliveryStage;
  location?: GeoPoint & { updatedAt: string };
  etaMinutes?: number;
  trackingUrl?: string;
  mock: boolean;
}
