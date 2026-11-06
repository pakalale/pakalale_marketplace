"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useHydrated } from "@/hooks/useHydrated";
import { useCartStore, cartItemCount, cartSubtotal } from "@/store/cartStore";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const router = useRouter();
  const { items, setQuantity, removeItem } = useCartStore();
  const mounted = useHydrated();

  const lines = mounted ? items : [];
  const count = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-left">
            <ShoppingBag className="h-4 w-4 text-brand" />
            Your cart
            {count > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">Your cart is empty</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add products you like and they will show up here.
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)}>Continue Shopping</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {lines.map((line) => (
                <div key={line.productId} className="flex gap-3 rounded-xl border border-border bg-card p-2.5">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {line.image ? (
                      <img src={line.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug">{line.name}</p>
                    {line.shopName && (
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{line.shopName}</p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-brand">K{line.price.toLocaleString()}</p>
                      <div className="flex items-center rounded-lg border border-border">
                        <button
                          className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
                          onClick={() => setQuantity(line.productId, line.quantity - 1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-[11px] font-semibold">{line.quantity}</span>
                        <button
                          className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                          onClick={() => setQuantity(line.productId, line.quantity + 1)}
                          disabled={line.quantity >= line.stock}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(line.productId)}
                    className="self-start rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-lg font-bold text-brand">K{subtotal.toLocaleString()}</span>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Sign in at checkout. Each shop arranges delivery after you order.
              </p>
              <Button
                className="h-11 w-full rounded-full text-sm font-semibold"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/checkout");
                }}
              >
                Checkout
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
