import crypto from "node:crypto";
import { estimateEtaMinutes, hashString } from "./pricing";
import type {
  DeliveryAgentInfo,
  DeliveryBooking,
  DeliveryBookingInput,
  DeliverySnapshot,
  DeliverySnapshotInput,
  DeliveryStage,
  GeoPoint,
} from "./types";

/**
 * Yango Delivery placeholder.
 *
 * The real integration is the Express API documented at
 * https://delivery.yango.com/docs/en/api/express/quickstart
 *
 *   POST {host}/b2b/cargo/integration/v2/claims/create?request_id=…
 *   POST {host}/b2b/cargo/integration/v2/claims/info        (estimation result)
 *   POST {host}/b2b/cargo/integration/v2/claims/accept      (starts courier search)
 *   POST {host}/b2b/cargo/integration/v2/claims/performer-position
 *   POST {host}/b2b/cargo/integration/v2/claims/cancel-info
 *   POST {host}/b2b/cargo/integration/v2/claims/cancel
 *
 * Auth is `Authorization: Bearer <token>`; the token comes from the merchant
 * portal under Integration → Get token.
 *
 * Without YANGO_DELIVERY_TOKEN every call below runs against a deterministic
 * mock so the whole lifecycle can be exercised end to end in the UI. The mock
 * moves a courier along the route over time, which is what makes the tracking
 * screens feel live before the contract is signed.
 *
 * Environment:
 *   YANGO_DELIVERY_TOKEN      OAuth token from the Yango merchant portal
 *   YANGO_DELIVERY_API_URL    optional host override (defaults to the public API)
 *   YANGO_COUNTRY_CODE        optional `X-Country` header (e.g. ZM)
 */

const DEFAULT_API_URL = "https://b2b.delivery.yango.tech/b2b/cargo/integration/v2";

export function isYangoMock(): boolean {
  return !process.env.YANGO_DELIVERY_TOKEN;
}

function apiUrl() {
  return (process.env.YANGO_DELIVERY_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

async function yangoRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.YANGO_DELIVERY_TOKEN;
  if (!token) throw new Error("Yango Delivery is not configured");

  const url = `${apiUrl()}${path}${path.includes("?") ? "&" : "?"}request_id=${crypto.randomUUID()}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(process.env.YANGO_COUNTRY_CODE ? { "X-Country": process.env.YANGO_COUNTRY_CODE } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Yango ${path} failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return (await response.json()) as T;
}

/** The subset of claims/info we consume. */
interface YangoClaim {
  id?: string;
  claim_id?: string;
  status?: string;
  version?: number;
  price?: number | string;
  eta?: number;
  tracking_link?: string;
  performer_info?: {
    name?: string;
    phone?: string;
    car_number?: string;
    car_type?: string;
    rating?: number;
  };
  route_points?: Array<{ coordinates?: [number, number]; type?: string }>;
}

const YANGO_STAGE_MAP: Record<string, DeliveryStage> = {
  new: "booked",
  estimating: "booked",
  ready_for_approval: "booked",
  accepted: "booked",
  performer_lookup: "booked",
  performer_found: "performer_found",
  pickup_arrived: "pickup_arrived",
  pickuped: "picked_up",
  delivery_arrived: "delivery_arrived",
  delivered: "delivered",
  cancelled: "cancelled",
};

export function mapYangoStage(status?: string): DeliveryStage {
  return YANGO_STAGE_MAP[status || ""] || "booked";
}

function claimAgent(claim: YangoClaim): DeliveryAgentInfo {
  const performer = claim.performer_info || {};
  return {
    name: performer.name || "Yango courier",
    phone: performer.phone || "",
    vehicle: performer.car_type || "Motorbike",
    plate: performer.car_number,
    rating: performer.rating,
  };
}

/** claims/create → claims/info → claims/accept. */
export async function bookYangoDelivery(input: DeliveryBookingInput): Promise<DeliveryBooking> {
  if (isYangoMock()) return mockBooking(input);

  const created = await yangoRequest<{ id?: string; claim_id?: string }>("/claims/create", {
    external_id: input.orderId,
    client_requirements: { taxi_class: "express" },
    route_points: [
      {
        point_id: 1,
        visit_order: 1,
        type: "source",
        address: { fullname: input.pickupAddress },
        contact: { name: input.shopName, phone: input.shopPhone || input.customerPhone },
      },
      {
        point_id: 2,
        visit_order: 2,
        type: "destination",
        address: { fullname: input.dropoffAddress },
        contact: { name: input.customerName, phone: input.customerPhone },
      },
    ],
    items: [
      {
        title: `Pakalale order ${input.orderId.slice(-6).toUpperCase()}`,
        quantity: 1,
        weight: 1,
        size: { length: 0.35, width: 0.3, height: 0.2 },
      },
    ],
    comment: input.note?.slice(0, 200),
  });

  const claimId = created.claim_id || created.id;
  if (!claimId) throw new Error("Yango did not return a claim id");

  // claims/info returns the estimate and the version that accept/cancel need.
  const info = await yangoRequest<YangoClaim>("/claims/info", { claim_id: claimId });
  if (info.status === "cancelled") throw new Error("Yango cancelled this claim");

  await yangoRequest<YangoClaim>("/claims/accept", { claim_id: claimId, version: info.version });

  return {
    externalId: claimId,
    provider: "yango",
    stage: mapYangoStage(info.status === "ready_for_approval" ? "accepted" : info.status),
    agent: claimAgent(info),
    trackingUrl: info.tracking_link,
    etaMinutes: info.eta ? Math.max(1, Math.round(info.eta / 60)) : estimateEtaMinutes(5),
    pickup: input.pickup,
    dropoff: input.dropoff,
    mock: false,
  };
}

export async function cancelYangoDelivery(externalId: string): Promise<void> {
  if (isYangoMock() || !externalId) return;
  const info = await yangoRequest<YangoClaim>("/claims/info", { claim_id: externalId });
  await yangoRequest<YangoClaim>("/claims/cancel", {
    claim_id: externalId,
    version: info.version,
    cancel_state: "free",
  });
}

/** Latest status + courier position for an in-flight claim. */
export async function getYangoSnapshot(input: DeliverySnapshotInput): Promise<DeliverySnapshot> {
  if (isYangoMock() || !input.externalId) return mockSnapshot(input);

  const [info, position] = await Promise.all([
    yangoRequest<YangoClaim>("/claims/info", { claim_id: input.externalId }),
    yangoRequest<{ position?: [number, number] }>("/claims/performer-position", {
      claim_id: input.externalId,
    }).catch(() => ({ position: undefined })),
  ]);

  const [lng, lat] = position.position || [];
  return {
    stage: mapYangoStage(info.status),
    location:
      typeof lat === "number" && typeof lng === "number"
        ? { lat, lng, updatedAt: new Date().toISOString() }
        : undefined,
    etaMinutes: info.eta ? Math.max(1, Math.round(info.eta / 60)) : undefined,
    trackingUrl: info.tracking_link,
    mock: false,
  };
}

// ── Mock provider ──
// Fast enough to watch in a demo: the courier reaches the shop in about a
// minute and the customer in about two more.

const MOCK_TO_SHOP_MS = 60_000;
const MOCK_TRANSIT_MS = 120_000;

const MOCK_COURIERS: DeliveryAgentInfo[] = [
  { name: "Chanda M.", phone: "+260 00 000 001", vehicle: "Motorbike", plate: "BAX 1234", rating: 4.9 },
  { name: "Mwila K.", phone: "+260 00 000 002", vehicle: "Motorbike", plate: "BAL 5521", rating: 4.8 },
  { name: "Tembo P.", phone: "+260 00 000 003", vehicle: "Car", plate: "BAY 7788", rating: 4.7 },
];

function mockAgent(seed: string): DeliveryAgentInfo {
  return MOCK_COURIERS[hashString(seed) % MOCK_COURIERS.length];
}

function mockBooking(input: DeliveryBookingInput): DeliveryBooking {
  const agent = mockAgent(input.orderId);
  return {
    externalId: `yango_mock_${hashString(input.orderId).toString(36)}`,
    provider: "yango",
    stage: "booked",
    agent,
    etaMinutes: estimateEtaMinutes(5),
    pickup: input.pickup,
    dropoff: input.dropoff,
    // A sandbox claim has no public Yango tracking page; the in-app map is used.
    trackingUrl: undefined,
    mock: true,
  };
}

function lerp(a: number, b: number, t: number) {
  return Math.round((a + (b - a) * t) * 1e6) / 1e6;
}

function pointBetween(from: GeoPoint, to: GeoPoint, t: number): GeoPoint {
  return { lat: lerp(from.lat, to.lat, t), lng: lerp(from.lng, to.lng, t) };
}

function mockSnapshot(input: DeliverySnapshotInput): DeliverySnapshot {
  const now = Date.now();
  const at = new Date(now).toISOString();
  const courierStart: GeoPoint = {
    lat: input.pickup.lat + 0.012,
    lng: input.pickup.lng - 0.01,
  };

  if (input.status === "delivered" || input.status === "completed") {
    return {
      stage: "delivered",
      location: { ...input.dropoff, updatedAt: at },
      etaMinutes: 0,
      mock: true,
    };
  }

  if (input.status === "cancelled") {
    return { stage: "cancelled", etaMinutes: 0, mock: true };
  }

  if (input.status === "approved") {
    return { stage: "booked", etaMinutes: input.dispatchedAt ? 0 : undefined, mock: true };
  }

  if (input.status === "delivery_in_progress") {
    const started = input.dispatchedAt?.getTime() ?? now;
    const progress = Math.min(1, Math.max(0, (now - started) / MOCK_TRANSIT_MS));
    const stage: DeliveryStage =
      progress >= 1 ? "delivered" : progress >= 0.85 ? "delivery_arrived" : "picked_up";
    return {
      stage,
      location: { ...pointBetween(input.pickup, input.dropoff, progress), updatedAt: at },
      etaMinutes: Math.max(0, Math.ceil(((1 - progress) * MOCK_TRANSIT_MS) / 60_000)),
      mock: true,
    };
  }

  if (input.status === "agent_assigned") {
    const booked = input.bookedAt?.getTime() ?? now;
    const progress = Math.min(1, Math.max(0, (now - booked) / MOCK_TO_SHOP_MS));
    return {
      stage: progress >= 1 ? "pickup_arrived" : "performer_found",
      location: { ...pointBetween(courierStart, input.pickup, progress), updatedAt: at },
      etaMinutes: Math.max(0, Math.ceil(((1 - progress) * MOCK_TO_SHOP_MS) / 60_000)),
      mock: true,
    };
  }

  return {
    stage: "delivered",
    location: { ...input.dropoff, updatedAt: at },
    etaMinutes: 0,
    mock: true,
  };
}
