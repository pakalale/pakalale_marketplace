"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink, Loader2, MapPin, Navigation, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PickupJourneyProps {
  orderId: string;
  role: "customer" | "shop";
  status: string;
  shop: { name: string; locationId?: string; coordinates?: { lat?: number; lng?: number } };
  customerLocation?: { lat: number; lng: number; updatedAt?: string };
  customerDistanceKm?: number;
  customerEtaMinutes?: number;
  onShared?: () => void | Promise<void>;
}

function shopMapsUrl(shop: PickupJourneyProps["shop"]) {
  if (typeof shop.coordinates?.lat === "number" && typeof shop.coordinates?.lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${shop.coordinates.lat},${shop.coordinates.lng}`;
  }
  const query = [shop.name, shop.locationId].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "shop")}`;
}

function directionsUrl(
  shop: PickupJourneyProps["shop"],
  customer: { lat: number; lng: number }
) {
  const destination = `${customer.lat},${customer.lng}`;
  const origin =
    typeof shop.coordinates?.lat === "number" && typeof shop.coordinates?.lng === "number"
      ? `${shop.coordinates.lat},${shop.coordinates.lng}`
      : undefined;
  const params = new URLSearchParams({ api: "1", destination });
  if (origin) params.set("origin", origin);
  params.set("travelmode", "driving");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function relativeTime(value?: string) {
  if (!value) return "";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

/**
 * Pickup is a face-to-face handover: the customer follows the shop's Google Maps
 * pin, and the shop watches how far away the customer is from live positions the
 * customer shares.
 */
export default function PickupJourney({
  orderId,
  role,
  status,
  shop,
  customerLocation,
  customerDistanceKm,
  customerEtaMinutes,
  onShared,
}: PickupJourneyProps) {
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);

  const stopSharing = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
  }, []);

  useEffect(() => stopSharing, [stopSharing]);

  const share = useCallback(
    async (lat: number, lng: number) => {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, customerLocation: { lat, lng } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not share your location");
      await onShared?.();
    },
    [onShared, orderId]
  );

  const startSharing = () => {
    if (!("geolocation" in navigator)) {
      toast.error("This device cannot share its location");
      return;
    }
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        // 20 seconds between updates is enough to show an approaching customer.
        if (Date.now() - lastSent.current < 20_000) return;
        lastSent.current = Date.now();
        setSaving(true);
        try {
          await share(position.coords.latitude, position.coords.longitude);
        } catch (cause) {
          toast.error(cause instanceof Error ? cause.message : "Could not share your location");
          stopSharing();
        } finally {
          setSaving(false);
        }
      },
      (cause) => {
        toast.error(
          cause.code === cause.PERMISSION_DENIED
            ? "Location permission was blocked. Allow it in your browser settings."
            : "Could not read your location. Make sure GPS is on."
        );
        stopSharing();
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
  };

  if (role === "customer") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Store className="h-3.5 w-3.5 text-brand" /> Collect from {shop.name}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pay cash at the shop. Share your location so they know when you are close.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={shopMapsUrl(shop)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-brand hover:bg-muted"
          >
            <MapPin className="h-3.5 w-3.5" /> Open shop in Google Maps <ExternalLink className="h-3 w-3" />
          </a>
          {status === "approved" && (
            <Button
              type="button"
              size="sm"
              variant={sharing ? "default" : "outline"}
              className="h-8 rounded-full text-[11px]"
              onClick={sharing ? stopSharing : startSharing}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Navigation className="mr-1.5 h-3.5 w-3.5" />
              )}
              {sharing ? "Stop sharing location" : "Share my location"}
            </Button>
          )}
        </div>
        {sharing && (
          <p className={cn("mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400")}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Sharing live location with the shop
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <MapPin className="h-3.5 w-3.5 text-brand" /> Customer distance
      </p>
      {customerLocation && typeof customerDistanceKm === "number" ? (
        <>
          <p className="text-sm font-semibold">
            {customerDistanceKm} km away
            {customerEtaMinutes ? <span className="font-normal text-muted-foreground"> · ~{customerEtaMinutes} min</span> : null}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Last shared {relativeTime(customerLocation.updatedAt)}
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <a
              href={directionsUrl(shop, customerLocation)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-brand hover:bg-muted"
            >
              <Navigation className="h-3.5 w-3.5" /> Directions to customer
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${customerLocation.lat},${customerLocation.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-brand hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open pin
            </a>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Waiting for the customer to share their location. You will see their distance here as they approach.
        </p>
      )}
    </div>
  );
}
