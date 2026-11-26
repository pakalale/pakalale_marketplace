"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/useHydrated";
import { formatKwacha } from "@/lib/product";
import { cartItemCount, cartSubtotal, useCartStore } from "@/store/cartStore";

export default function CustomerCartPage() {
  const router = useRouter();
  const { items, setQuantity, removeItem } = useCartStore();
  const mounted = useHydrated();
  const lines = mounted ? items : [];
  const count = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  return (
    <div className="min-h-screen bg-background">
      <Header activeTab="cart" />
      <main className="mx-auto max-w-5xl space-y-4 p-3 pb-24 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold"><ShoppingCart className="h-5 w-5 text-brand" /> Your Cart</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {count === 0 ? "Nothing in your cart yet" : `${count} ${count === 1 ? "item" : "items"}`}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/customer/locations")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Shop
          </Button>
        </div>

        {lines.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">Your cart is empty</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose products from a shop to get started.</p>
            <Button className="mt-4" onClick={() => router.push("/customer/locations")}>Browse shops</Button>
          </section>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="divide-y divide-border rounded-xl border border-border bg-card px-4">
              {lines.map((line) => (
                <article key={line.productId} className="flex items-center gap-3 py-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {line.image ? <Image src={line.image} alt="" width={64} height={64} className="h-full w-full object-cover" /> : <ShoppingBag className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-sm font-semibold">{line.name}</h2>
                    {line.shopName && <p className="mt-0.5 truncate text-xs text-muted-foreground">{line.shopName}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatKwacha(line.price)} each</p>
                    <div className="mt-2 flex w-fit items-center rounded-md border border-border">
                      <button type="button" aria-label={`Decrease ${line.name}`} onClick={() => setQuantity(line.productId, line.quantity - 1)} className="flex h-8 w-8 items-center justify-center hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                      <button type="button" aria-label={`Increase ${line.name}`} disabled={line.quantity >= line.stock} onClick={() => setQuantity(line.productId, line.quantity + 1)} className="flex h-8 w-8 items-center justify-center hover:bg-muted disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <p className="text-sm font-bold text-brand">{formatKwacha(line.price * line.quantity)}</p>
                    <button type="button" aria-label={`Remove ${line.name}`} onClick={() => removeItem(line.productId)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <strong className="text-lg text-brand">{formatKwacha(subtotal)}</strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Delivery and payment options are selected at checkout.</p>
              <Button className="mt-4 h-11 w-full font-semibold" onClick={() => router.push("/customer/checkout")}>
                Continue to checkout
              </Button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}