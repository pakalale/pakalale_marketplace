import crypto from "node:crypto";
import { bookDelivery, type DeliveryBooking } from "./index";
import { DEFAULT_ORIGIN, mockDropoff } from "./pricing";
import type { GeoPoint } from "./types";

export interface BookableOrder {
  id: string;
  provider: "yango" | "indrive";
  shopName: string;
  shopPhone?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  note?: string;
  pickup?: GeoPoint;
  dropoff?: GeoPoint;
  distanceKm?: number;
  /** Minted on first booking and reused by the courier's no-login page. */
  trackingToken?: string;
}

export function routeFor(order: BookableOrder): { pickup: GeoPoint; dropoff: GeoPoint } {
  const pickup = order.pickup || DEFAULT_ORIGIN;
  const dropoff =
    order.dropoff ||
    mockDropoff(pickup, order.distanceKm && order.distanceKm > 0 ? order.distanceKm : 5, order.deliveryAddress || order.id);
  return { pickup, dropoff };
}

/** Fields written to the order once the provider accepts the job. */
export function bookingUpdateFields(booking: DeliveryBooking, trackingToken: string) {
  return {
    status: "agent_assigned",
    "delivery.provider": booking.provider,
    "delivery.externalId": booking.externalId,
    "delivery.stage": booking.stage,
    "delivery.trackingUrl": booking.trackingUrl,
    "delivery.etaMinutes": booking.etaMinutes,
    "delivery.bookedAt": new Date(),
    "delivery.mock": booking.mock,
    "delivery.pickup": booking.pickup,
    "delivery.dropoff": booking.dropoff,
    "deliveryAgent.name": booking.agent.name,
    "deliveryAgent.phone": booking.agent.phone,
    "deliveryAgent.vehicle": booking.agent.vehicle,
    "deliveryAgent.plate": booking.agent.plate,
    "deliveryAgent.trackingToken": trackingToken,
  } satisfies Record<string, unknown>;
}

export async function bookOrderCourier(
  order: BookableOrder
): Promise<{ booking: DeliveryBooking; trackingToken: string }> {
  const { pickup, dropoff } = routeFor(order);
  const booking = await bookDelivery({
    orderId: order.id,
    provider: order.provider,
    pickup,
    dropoff,
    pickupAddress: order.shopName,
    dropoffAddress: order.deliveryAddress || "Customer address",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shopName: order.shopName,
    shopPhone: order.shopPhone,
    note: order.note,
  });

  return {
    booking,
    trackingToken: order.trackingToken || crypto.randomBytes(16).toString("hex"),
  };
}
