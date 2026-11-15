"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHydrated } from "@/hooks/useHydrated";
import { cartItemCount, cartSubtotal, useCartStore } from "@/store/cartStore";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Checkout is gated: signed-out visitors are prompted to create an account. */
  onCheckout: () => void;
}

export default function CartSheet({ open, onOpenChange, onCheckout }: CartSheetProps) {
  const router = useRouter();
  const { items, setQuantity, removeItem } = useCartStore();
  const mounted = useHydrated();

  const lines = mounted ? items : [];
  const count = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border p-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-left">
            <ShoppingBag className="h-4 w-4 text-brand" />
            Your cart
            {count > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review your items. You can sign in or create an account at checkout.
          </DialogDescription>
        </DialogHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">Your cart is empty</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add products you like and they will show up here.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { onOpenChange(false); router.push("/saved"); }}>
                Saved items
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  router.push("/customer/locations");
                }}
              >
                Browse products
              </Button>
            </div>
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-11 flex-1 rounded-full text-sm font-semibold"
                  onClick={() => {
                    onOpenChange(false);
                    router.push("/cart");
                  }}
                >
                  View cart
                </Button>
                <Button className="h-11 flex-[1.4] rounded-full text-sm font-semibold" onClick={onCheckout}>
                  Checkout
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
