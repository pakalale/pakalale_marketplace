"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, MapPin, Phone, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AgentLocation {
  lat: number;
  lng: number;
  updatedAt?: string;
}

interface DeliveryLocationButtonProps {
  orderId: string;
  /** Optional first paint; the dialog always re-reads the latest position. */
  agent?: { name?: string; phone?: string; location?: AgentLocation };
  compact?: boolean;
}

function relativeTime(value?: string) {
  if (!value) return "";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}

/**
 * Map icon shown while an order is out for delivery. Opens the delivery agent's
 * last shared position, which the agent pushes from their tracking link.
 */
export default function DeliveryLocationButton({ orderId, agent, compact }: DeliveryLocationButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(agent ?? {});

  const fetchAgent = useCallback(async () => {
    const res = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load the delivery location");
    const fresh = data.orders?.[0]?.deliveryAgent;
    if (fresh) setCurrent(fresh);
  }, [orderId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch(`/api/orders?id=${encodeURIComponent(orderId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load the delivery location");
        const fresh = data.orders?.[0]?.deliveryAgent;
        if (active && fresh) setCurrent(fresh);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load the delivery location");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, orderId]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      await fetchAgent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the delivery location");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setLoading(true);
      setError("");
    }
  };

  const location = current.location;
  const hasFix = Boolean(location && typeof location.lat === "number" && typeof location.lng === "number");
  const mapsUrl = hasFix
    ? `https://www.google.com/maps/search/?api=1&query=${location!.lat},${location!.lng}`
    : undefined;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        className={compact ? "h-9 px-2.5" : undefined}
        onClick={() => handleOpenChange(true)}
        aria-label="Show delivery agent location"
      >
        <MapPin className="h-4 w-4" />
        {!compact && <span className="ml-2">Track delivery</span>}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand" /> Delivery agent
            </DialogTitle>
            <DialogDescription>Last position shared from the agent&apos;s tracking link.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {current.name && (
              <p className="font-semibold">{current.name}</p>
            )}
            {current.phone && (
              <a href={`tel:${current.phone}`} className="flex items-center gap-2 text-brand">
                <Phone className="h-4 w-4" /> {current.phone}
              </a>
            )}

            {loading && !hasFix ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking the agent&apos;s location…
              </p>
            ) : hasFix ? (
              <div className="space-y-1 rounded-lg bg-muted/60 p-3">
                <p className="font-medium">
                  {location!.lat.toFixed(5)}, {location!.lng.toFixed(5)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Updated {relativeTime(location!.updatedAt) || "just now"}
                </p>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                Waiting for the delivery agent to share their location. You can still call them if a phone number is
                shown.
              </p>
            )}

            {error && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={refresh} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ className: "flex-1" })}
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> Open map
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
