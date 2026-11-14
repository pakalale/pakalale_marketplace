import type { NextRequest } from "next/server";

// In-memory limits. PM2 runs a single instance (see ecosystem.config.cjs), so
// one process sees every request. Counts reset when the server restarts.
const hits = new Map<string, number[]>();

/** Returns true when this key is still under `limit` attempts in `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [entry, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(entry);
    }
  }
  return true;
}

export function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
