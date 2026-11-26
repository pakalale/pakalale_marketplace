"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Phone,
  Store,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderStatusLabel } from "@/lib/orderStatus";

interface TrackedOrder {
  status: string;
  deliveryMethod?: string;
  deliveryAddress?: string;
  customerPhone?: string;
  notes?: string;
  items: number;
  shop: { name: string; locationId?: string; coordinates?: { lat: number; lng: number } } | null;
  agent: { name?: string; phone?: string; location?: { lat: number; lng: number; updatedAt: string } };
  delivery?: {
    provider?: string;
    stage?: string;
    etaMinutes?: number;
    mock?: boolean;
    dropoff?: { lat: number; lng: number };
  };
}

const STAGE_LABELS: Record<string, string> = {
  booked: "Courier requested",
  performer_found: "You are heading to the shop",
  pickup_arrived: "At the shop — collect the parcel",
  picked_up: "On the way to the customer",
  delivery_arrived: "Arriving at the customer",
  delivered: "Trip complete",
  cancelled: "Cancelled",
  failed: "Booking failed",
};

function mapsSearch(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Don't spam the API: send at most every 15s, or when the agent moved ~25m. */
const MIN_INTERVAL_MS = 15_000;
const MIN_MOVE_METERS = 25;

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

export default function DeliveryTrackingPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [sharedAt, setSharedAt] = useState<Date | null>(null);
  const [marking, setMarking] = useState(false);

  const watchId = useRef<number | null>(null);
  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/track?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load this delivery");
    setOrder(data.order);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`/api/orders/track?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load this delivery");
        if (active) setOrder(data.order);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load this delivery");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const stopSharing = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
  }, []);

  useEffect(() => stopSharing, [stopSharing]);

  const startSharing = () => {
    if (!("geolocation" in navigator)) {
      setError("This device cannot share its location.");
      return;
    }
    setError("");
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const now = Date.now();
        const previous = lastSent.current;
        const dueByTime = !previous || now - previous.at >= MIN_INTERVAL_MS;
        const dueByMove = !previous || metresBetween(previous, { lat, lng }) >= MIN_MOVE_METERS;
        if (!dueByTime && !dueByMove) return;

        lastSent.current = { at: now, lat, lng };
        try {
          const res = await fetch("/api/orders/track", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, lat, lng }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not share your location");
          setSharedAt(new Date());
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Could not share your location");
          stopSharing();
        }
      },
      (cause) => {
        setError(
          cause.code === cause.PERMISSION_DENIED
            ? "Location permission was blocked. Allow it in your browser settings and try again."
            : "Could not read your location. Make sure GPS is on."
        );
        stopSharing();
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
  };

  const markDelivered = async () => {
    setMarking(true);
    setError("");
    try {
      const res = await fetch("/api/orders/track", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "delivered" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mark this delivery");
      stopSharing();
      await fetchOrder();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark this delivery");
    } finally {
      setMarking(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-background p-4 pb-16">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pakalale delivery</p>
        <h1 className="flex items-center gap-2 text-lg font-bold"><Truck className="h-5 w-5 text-brand" /> Delivery run</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
      ) : !order ? (
        <section className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error || "This tracking link is not valid."}
        </section>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{order.shop?.name || "Shop"}</span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                {orderStatusLabel(order.status, order.deliveryMethod)}
              </span>
            </div>

            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span className="flex-1">{order.deliveryAddress || "Pickup from the shop"}</span>
              {order.deliveryAddress && (
                <a
                  href={mapsSearch(order.deliveryAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-brand"
                >
                  Map <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-brand" />
              {order.items} {order.items === 1 ? "item" : "items"}
            </p>
            {order.delivery?.stage && (
              <p className="rounded-lg bg-muted/60 px-2.5 py-2 text-xs font-medium">
                {STAGE_LABELS[order.delivery.stage] || "Delivery in progress"}
                {typeof order.delivery.etaMinutes === "number" && order.delivery.etaMinutes > 0
                  ? ` · ~${order.delivery.etaMinutes} min`
                  : ""}
                {order.delivery.mock ? " · sandbox" : ""}
              </p>
            )}
            {order.customerPhone && (
              <a href={`tel:${order.customerPhone}`} className="flex items-center gap-2 text-sm text-brand">
                <Phone className="h-4 w-4" />
                {order.customerPhone}
              </a>
            )}
            {order.notes && <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">{order.notes}</p>}
            {order.shop && (
              <a
                href={
                  order.shop.coordinates
                    ? mapsSearch(`${order.shop.coordinates.lat},${order.shop.coordinates.lng}`)
                    : mapsSearch([order.shop.name, order.shop.locationId].filter(Boolean).join(" "))
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-brand"
              >
                <Store className="h-3.5 w-3.5" /> Collect from {order.shop.name}
                {order.shop.locationId ? ` · ${order.shop.locationId}` : ""}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </section>

          {order.status === "cancelled" ? (
            <section className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              This order was cancelled, so there is nothing to deliver.
            </section>
          ) : order.status === "delivered" || order.status === "completed" ? (
            <section className="flex items-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Delivery recorded. Thank you.
            </section>
          ) : (
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold">Share your location</h2>
              <p className="text-xs text-muted-foreground">
                While this page stays open the customer can follow you on the map. Stop any time.
              </p>

              {sharing ? (
                <Button type="button" variant="outline" className="w-full" onClick={stopSharing}>
                  Stop sharing
                </Button>
              ) : (
                <Button type="button" className="w-full" onClick={startSharing}>
                  <Navigation className="mr-2 h-4 w-4" /> Start sharing location
                </Button>
              )}

              {sharing && (
                <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Sharing{sharedAt ? ` · updated ${sharedAt.toLocaleTimeString()}` : "…"}
                </p>
              )}

              {error && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}

              <Button type="button" variant="secondary" className="w-full" disabled={marking} onClick={markDelivered}>
                {marking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Mark as delivered
              </Button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
