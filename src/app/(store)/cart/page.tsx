"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Container from "@/components/landing/Container";
import GuestAccountPrompt from "@/components/landing/GuestAccountPrompt";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/useHydrated";
import { cartItemCount, cartSubtotal, useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { formatKwacha } from "@/lib/product";

export default function StoreCartPage() {
  const router = useRouter();
  const { items, setQuantity, removeItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const mounted = useHydrated();
  const [promptOpen, setPromptOpen] = useState(false);

  const lines = mounted ? items : [];
  const count = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  const checkout = () => {
    if (!isAuthenticated) {
      setPromptOpen(true);
      return;
    }
    router.push("/checkout");
  };

  return (
    <Container className="max-w-4xl py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand">Your Cart</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {count === 0 ? "Nothing in your cart yet" : `${count} ${count === 1 ? "item" : "items"}`}
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/customer/locations")}>Continue shopping</Button>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Your cart is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Add products you like and they will show up here.</p>
          <Button className="mt-4 rounded-full" onClick={() => router.push("/customer/locations")}>Browse products</Button>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.productId} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {line.image ? (
                    <img src={line.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{line.name}</p>
                  {line.shopName && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{line.shopName}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-brand">{formatKwacha(line.price)}</p>
                    <div className="flex items-center rounded-lg border border-border">
                      <button
                        className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        aria-label={`Decrease quantity of ${line.name}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-semibold">{line.quantity}</span>
                      <button
                        className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                        onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        disabled={line.quantity >= line.stock}
                        aria-label={`Increase quantity of ${line.name}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeItem(line.productId)}
                  aria-label={`Remove ${line.name}`}
                  className="self-start rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-2xl font-bold text-brand">{formatKwacha(subtotal)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Each shop arranges delivery after you order. You can create an account at checkout.
            </p>
            <Button className="mt-3 h-11 w-full rounded-full text-sm font-semibold" onClick={checkout}>
              Checkout
            </Button>
          </aside>
        </div>
      )}

      <GuestAccountPrompt open={promptOpen} onOpenChange={setPromptOpen} />
    </Container>
  );
}
