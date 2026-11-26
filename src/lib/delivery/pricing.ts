import crypto from "node:crypto";
import type { DeliveryProviderId, DeliveryQuote, GeoPoint } from "./types";

/**
 * Delivery pricing.
 *
 * Until the Yango contract is live the price is estimated locally: a base fee
 * plus a per-kilometre rate, rounded to the nearest K5. The distance is a
 * deterministic stand-in derived from the shop and address (no geocoding
 * service is wired in yet). Swapping in Yango's `claims/create` estimate later
 * only changes where `distanceKm` and `fee` come from — the quote token and the
 * order flow stay the same.
 */
export const DELIVERY_BASE_FEE = 30;
export const DELIVERY_PER_KM = 6;
export const DELIVERY_MIN_FEE = 40;
export const QUOTE_TTL_MS = 10 * 60 * 1000;

/** Lusaka, used when a shop has no pin yet. */
export const DEFAULT_ORIGIN: GeoPoint = { lat: -15.4167, lng: 28.2833 };

export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function addressHash(address: string): string {
  return hashString(address.trim().toLowerCase()).toString(36);
}

/** 2.5–8.5 km, stable for the same shop + address pair. */
export function estimateDistanceKm(seed: string): number {
  const spread = hashString(seed) % 600;
  return Math.round((2.5 + spread / 100) * 10) / 10;
}

export function calculateDeliveryFee(distanceKm: number): number {
  const raw = DELIVERY_BASE_FEE + DELIVERY_PER_KM * distanceKm;
  return Math.max(DELIVERY_MIN_FEE, Math.round(raw / 5) * 5);
}

export function estimateEtaMinutes(distanceKm: number): number {
  // ~25 km/h in town plus a few minutes for the courier to reach the shop.
  return Math.max(12, Math.round((distanceKm / 25) * 60) + 8);
}

function metresBetween(a: GeoPoint, b: GeoPoint) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

export function distanceBetweenKm(a: GeoPoint, b: GeoPoint): number {
  return Math.round((metresBetween(a, b) / 1000) * 10) / 10;
}

/** A stand-in drop-off pin so the demo map has somewhere to travel to. */
export function mockDropoff(origin: GeoPoint, distanceKm: number, seed: string): GeoPoint {
  const angle = ((hashString(seed) % 360) * Math.PI) / 180;
  const deltaLat = distanceKm / 111;
  return {
    lat: Math.round((origin.lat + Math.cos(angle) * deltaLat) * 1e6) / 1e6,
    lng:
      Math.round(
        (origin.lng + (Math.sin(angle) * deltaLat) / Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180))) * 1e6
      ) / 1e6,
  };
}

// ── Signed, stateless quotes ──
// A quote is a small signed payload: the order route re-verifies it so the
// browser cannot name its own delivery fee.

interface QuotePayload {
  shopId: string;
  provider: DeliveryProviderId;
  fee: number;
  distanceKm: number;
  etaMinutes: number;
  addr: string;
  exp: number;
}

function quoteSecret() {
  return (
    process.env.DELIVERY_QUOTE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "pakalale-local-quote-secret"
  );
}

function sign(value: string) {
  return crypto.createHmac("sha256", quoteSecret()).update(value).digest("base64url");
}

export function buildQuote(input: {
  shopId: string;
  provider: DeliveryProviderId;
  distanceKm: number;
  address: string;
}): DeliveryQuote {
  const distanceKm = Math.round(input.distanceKm * 10) / 10;
  const fee = calculateDeliveryFee(distanceKm);
  const etaMinutes = estimateEtaMinutes(distanceKm);
  const payload: QuotePayload = {
    shopId: input.shopId,
    provider: input.provider,
    fee,
    distanceKm,
    etaMinutes,
    addr: addressHash(input.address),
    exp: Date.now() + QUOTE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    quoteId: `${body}.${sign(body)}`,
    shopId: input.shopId,
    provider: input.provider,
    fee,
    currency: "ZMW",
    distanceKm,
    etaMinutes,
    expiresAt: new Date(payload.exp).toISOString(),
    mock: !process.env.YANGO_DELIVERY_TOKEN,
  };
}

export function verifyQuote(token: unknown): Omit<QuotePayload, "exp"> | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as QuotePayload;
    if (!payload || typeof payload.fee !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    if (!["yango", "indrive"].includes(payload.provider)) return null;
    return payload;
  } catch {
    return null;
  }
}
