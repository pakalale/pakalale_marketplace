import {
  bookYangoDelivery,
  cancelYangoDelivery,
  getYangoSnapshot,
  isYangoMock,
} from "./yango";
import type {
  DeliveryBooking,
  DeliveryBookingInput,
  DeliveryProviderId,
  DeliverySnapshot,
  DeliverySnapshotInput,
} from "./types";

/**
 * One door for every delivery partner. Yango is the live integration; adding
 * another provider means implementing these four calls and nothing else.
 */

export const DELIVERY_PROVIDER_LABELS: Record<DeliveryProviderId, string> = {
  yango: "Yango",
  indrive: "inDrive",
};

export function isPlaceholderDelivery() {
  return isYangoMock();
}

export async function bookDelivery(input: DeliveryBookingInput): Promise<DeliveryBooking> {
  if (input.provider === "yango") return bookYangoDelivery(input);
  // inDrive has no public delivery API yet. Orders created before Yango became
  // the partner can still be read, but new inDrive bookings are refused.
  throw new Error("inDrive delivery is not available. Choose Yango or pick up from the shop.");
}

export async function cancelDelivery(provider: DeliveryProviderId, externalId?: string): Promise<void> {
  if (!externalId) return;
  if (provider === "yango") {
    await cancelYangoDelivery(externalId);
    return;
  }
  // Nothing to call for a placeholder provider.
}

export async function getDeliverySnapshot(input: DeliverySnapshotInput): Promise<DeliverySnapshot> {
  return getYangoSnapshot(input);
}

export type {
  DeliveryBooking,
  DeliveryBookingInput,
  DeliveryProviderId,
  DeliverySnapshot,
  DeliverySnapshotInput,
} from "./types";
