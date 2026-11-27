"use client";

import { Ban } from "lucide-react";
import { normalizeOrderStatus, orderLifecycleSteps } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";

interface OrderLifecycleProps {
  status: string;
  deliveryMethod?: string;
  className?: string;
}

/**
 * The customer's and shop's shared view of where an order is in the cycle:
 * placed → shop confirmed → courier assigned → dispatched → delivered →
 * confirmed. Pickup orders show the shorter collect-in-person path instead.
 */
export default function OrderLifecycle({ status, deliveryMethod, className }: OrderLifecycleProps) {
  const normalized = normalizeOrderStatus(status);

  if (normalized === "cancelled") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive",
          className
        )}
      >
        <Ban className="h-3.5 w-3.5" />
        Order cancelled — no courier is dispatched and any escrow payment is refunded.
      </div>
    );
  }

  const steps = orderLifecycleSteps(deliveryMethod);
  const currentIndex = steps.findIndex((step) => step.status === normalized);

  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="Order progress">
      {steps.map((step, index) => {
        const done = currentIndex > index;
        const active = currentIndex === index;
        return (
          <li key={step.status} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 && (
              <span
                className={cn(
                  "absolute left-0 top-[7px] h-0.5 w-1/2",
                  currentIndex >= index ? "bg-emerald-500" : "bg-border"
                )}
              />
            )}
            {index < steps.length - 1 && (
              <span
                className={cn(
                  "absolute right-0 top-[7px] h-0.5 w-1/2",
                  currentIndex > index ? "bg-emerald-500" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 h-4 w-4 rounded-full border-2",
                active
                  ? "border-brand bg-brand ring-4 ring-brand/15"
                  : done
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-border bg-card"
              )}
            />
            <span
              className={cn(
                "mt-1.5 max-w-full px-0.5 text-[9.5px] leading-tight sm:text-[10px]",
                active ? "font-semibold text-foreground" : done ? "text-foreground/80" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
