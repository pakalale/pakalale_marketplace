"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Store,
  Truck,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canTrackCourier } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";

interface AgentInfo {
  name?: string;
  phone?: string;
  vehicle?: string;
  plate?: string;
}

interface TrackingData {
  orderId: string;
  status: string;
  provider?: string;
  stage: string;
  mock?: boolean;
  etaMinutes?: number;
  trackingUrl?: string;
  location?: { lat: number; lng: number; updatedAt?: string };
  agent?: AgentInfo;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
}

interface DeliveryTrackerProps {
  orderId: string;
  status: string;
  /** First paint from the order payload; the dialog re-reads live values. */
  delivery?: {
    provider?: string;
    stage?: string;
    etaMinutes?: number;
    trackingUrl?: string;
    mock?: boolean;
    pickup?: { lat: number; lng: number };
    dropoff?: { lat: number; lng: number };
  };
  agent?: AgentInfo & { location?: { lat: number; lng: number; updatedAt?: string } };
  dropoffAddress?: string;
  compact?: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  booked: "Courier requested",
  performer_found: "Courier heading to shop",
  pickup_arrived: "Courier at the shop",
  picked_up: "On the way to you",
  delivery_arrived: "Courier is nearby",
  delivered: "Delivered",
  cancelled: "Delivery cancelled",
  failed: "Booking failed",
  quoted: "Price confirmed",
};

function relativeTime(value?: string) {
  if (!value) return "";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

function mapUrl(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Both the customer and the shop watch the same courier here. The dialog polls
 * the delivery endpoint every 10 seconds; the endpoint asks the provider (or the
 * sandbox courier) for the latest position and stage.
 */
export default function DeliveryTracker({
  orderId,
  status,
  delivery,
  agent,
  dropoffAddress,
  compact,
}: DeliveryTrackerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState<TrackingData | undefined>(
    delivery
      ? {
          orderId,
          status,
          provider: delivery.provider,
          stage: delivery.stage || "booked",
          mock: delivery.mock,
          etaMinutes: delivery.etaMinutes,
          trackingUrl: delivery.trackingUrl,
          pickup: delivery.pickup,
          dropoff: delivery.dropoff,
          location: agent?.location,
          agent,
        }
      : undefined
  );
  const mounted = useRef(true);
  // Polling is only useful while the parcel is moving; a delivered trip is a
  // static final position.
  const live = tracking?.status || status;
  const active = ["agent_assigned", "delivery_in_progress"].includes(live);
  const canView = canTrackCourier(live);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/delivery/track?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not refresh the courier position");
      if (mounted.current) {
        setTracking(data.tracking);
        setError("");
      }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Could not refresh the courier position");
      }
    }
  }, [orderId]);

  // Poll while the parcel is with the courier, and whenever the dialog is open.
  useEffect(() => {
    if (!active && !open) return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void load();
    }, 10_000);
    return () => clearInterval(timer);
  }, [active, open, load]);

  const refresh = async () => {
    setLoading(true);
    await load();
    if (mounted.current) setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setLoading(true);
      void load().finally(() => {
        if (mounted.current) setLoading(false);
      });
    }
  };

  const location = tracking?.location;
  const hasFix = typeof location?.lat === "number" && typeof location?.lng === "number";
  const stage = tracking?.stage || "booked";
  const stageLabel = STAGE_LABELS[stage] || "Delivery in progress";
  const courier = tracking?.agent;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        className={compact ? "h-9 px-2.5" : undefined}
        onClick={() => handleOpenChange(true)}
        aria-label="Track the courier"
      >
        <Truck className="h-4 w-4" />
        {!compact && (
          <span className="ml-2">
            {tracking?.mock ? "Track courier (demo)" : "Track courier"}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-brand" /> {tracking?.provider === "indrive" ? "inDrive" : "Yango"} courier
            </DialogTitle>
            <DialogDescription>
              Live trip from the shop to you. Refreshes every 10 seconds.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
              <span className="font-semibold">{stageLabel}</span>
              <span className="text-xs text-muted-foreground">
                {typeof tracking?.etaMinutes === "number"
                  ? tracking.etaMinutes > 0
                    ? `~${tracking.etaMinutes} min`
                    : "Arrived"
                  : ""}
              </span>
            </div>

            {courier?.name && (
              <div className="rounded-lg border border-border p-3">
                <p className="font-semibold">
                  {courier.name}
                  {courier.vehicle ? <span className="font-normal text-muted-foreground"> · {courier.vehicle}</span> : null}
                </p>
                {courier.plate && <p className="text-xs text-muted-foreground">{courier.plate}</p>}
                {courier.phone && (
                  <a href={`tel:${courier.phone}`} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                    <Phone className="h-3.5 w-3.5" /> {courier.phone}
                  </a>
                )}
              </div>
            )}

            {hasFix ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <iframe
                  key={`${location!.lat},${location!.lng}`}
                  title="Courier position"
                  className="h-52 w-full"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${location!.lng - 0.012}%2C${location!.lat - 0.009}%2C${location!.lng + 0.012}%2C${location!.lat + 0.009}&layer=mapnik&marker=${location!.lat}%2C${location!.lng}`}
                />
                <div className="flex items-center justify-between gap-2 bg-card px-3 py-2 text-[11px] text-muted-foreground">
                  <span>Courier position {relativeTime(location!.updatedAt)}</span>
                  <a
                    href={mapUrl(location!.lat, location!.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand"
                  >
                    <ExternalLink className="h-3 w-3" /> Google Maps
                  </a>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                Waiting for the courier&apos;s first position. This appears as soon as they start moving.
              </p>
            )}

            {dropoffAddress && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> Delivering to {dropoffAddress}
              </p>
            )}

            {tracking?.mock && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
                Sandbox courier: Yango is not connected yet, so this trip is simulated for testing. Live Yango tracking
                appears here once the merchant token is configured.
              </p>
            )}

            {error && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={refresh} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh now
              </Button>
              {tracking?.trackingUrl && !tracking.mock && (
                <a
                  href={tracking.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ className: "flex-1" })}
                >
                  <Navigation className="mr-2 h-4 w-4" /> Open in Yango
                </a>
              )}
            </div>

            <p className={cn("flex items-center gap-1.5 text-[10px]", active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
              <Store className="h-3 w-3" />
              {active ? "Trip in progress" : canView ? "Trip finished" : "Waiting for a courier"}
              {tracking?.status === "delivered" ? " · waiting for the customer to confirm receipt" : ""}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
