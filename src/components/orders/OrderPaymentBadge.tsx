"use client";

import { Banknote, RotateCcw, ShieldCheck, CheckCircle2 } from "lucide-react";
import { formatKwacha } from "@/lib/product";
import { cn } from "@/lib/utils";

interface OrderPaymentBadgeProps {
  escrow?: {
    status: "held" | "released" | "refunded" | "cash" | "none";
    amount: number;
    goodsAmount?: number;
    deliveryFee?: number;
    shopPayout?: number;
    courierPayout?: number;
  };
  paymentMethod?: string;
  className?: string;
}

/** One small pill that explains where the money is in the escrow life cycle. */
export default function OrderPaymentBadge({ escrow, paymentMethod, className }: OrderPaymentBadgeProps) {
  if (!escrow || escrow.status === "none") return null;

  if (escrow.status === "held") {
    return (
      <span
        title="Released to the shop only after you confirm you received the parcel"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300",
          className
        )}
      >
        <ShieldCheck className="h-3 w-3" /> {formatKwacha(escrow.amount)} Payment held
      </span>
    );
  }

  if (escrow.status === "released") {
    return (
      <span
        title={`Shop ${formatKwacha(escrow.shopPayout || 0)}${escrow.courierPayout ? ` · courier ${formatKwacha(escrow.courierPayout)}` : ""}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300",
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3" /> Escrow released
      </span>
    );
  }

  if (escrow.status === "refunded") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground",
          className
        )}
      >
        <RotateCcw className="h-3 w-3" /> Refunded
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground",
        className
      )}
    >
      <Banknote className="h-3 w-3" />
      {paymentMethod === "cash" || paymentMethod === "Cash" ? "Cash on pickup" : "Cash"}
    </span>
  );
}
