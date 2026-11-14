"use client";

import { Bike, Car, Store, Truck } from "lucide-react";
import { DELIVERY_OPTIONS, type DeliveryId } from "@/lib/delivery";
import { formatKwacha } from "@/lib/product";
import { cn } from "@/lib/utils";

const ICONS: Record<DeliveryId, typeof Car> = { yango: Car, indrive: Bike, pickup: Store };

/** The delivery choice shown in the cart panel and at checkout. */
export default function DeliveryOptions({
  value,
  onChange,
  shopCount,
  className,
}: {
  value: DeliveryId;
  onChange: (value: DeliveryId) => void;
  shopCount: number;
  className?: string;
}) {
  return (
    <fieldset className={cn("rounded-2xl bg-brand-soft p-3 dark:bg-muted", className)}>
      <legend className="flex w-full items-center gap-2 px-1 pb-2 pt-1 text-sm font-bold text-brand">
        <Truck className="h-4 w-4" /> Choose Delivery Option
      </legend>
      <div className="space-y-1">
        {DELIVERY_OPTIONS.map((option) => {
          const Icon = ICONS[option.id];
          const selected = option.id === value;
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors",
                selected ? "bg-card shadow-sm" : "hover:bg-card/60"
              )}
            >
              <input
                type="radio"
                name="delivery"
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="h-4 w-4 shrink-0 accent-[var(--brand)]"
              />
              <Icon className="h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{option.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{option.eta}</span>
              </span>
              <span className="shrink-0 font-semibold">{option.fee === 0 ? "Free" : formatKwacha(option.fee)}</span>
            </label>
          );
        })}
      </div>
      {shopCount > 1 && (
        <p className="px-1 pt-2 text-xs text-muted-foreground">
          Your cart is from {shopCount} shops. Each shop delivers its own order, so delivery is charged per shop.
        </p>
      )}
    </fieldset>
  );
}
