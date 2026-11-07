"use client";

import { useRouter } from "next/navigation";
import { Heart, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/useHydrated";
import { cartLineFromProduct } from "@/lib/cart";
import { formatKwacha, productImage } from "@/lib/product";
import { cartItemCount, cartSubtotal, useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

export default function CustomerCartPage() {
  const router = useRouter();
  const { items, setQuantity, removeItem } = useCartStore();
  const addItem = useCartStore((state) => state.addItem);
  const { items: savedItems, remove: removeSaved } = useWishlistStore();
  const mounted = useHydrated();

  const lines = mounted ? items : [];
  const saved = mounted ? savedItems : [];
  const count = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  return (
    <div className="min-h-screen bg-background">
      <Header activeTab="cart" />
      <main className="mx-auto max-w-2xl space-y-6 p-3 pb-24 sm:p-4">
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold">My Cart</h1>
              <p className="text-xs text-muted-foreground">
                {count === 0 ? "Nothing in your cart yet" : `${count} ${count === 1 ? "item" : "items"} ready to order`}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push("/")}>
              Continue shopping
            </Button>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <ShoppingCart className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Your cart is empty</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add products from the storefront or from a shop and they will show up here.
              </p>
              <Button className="mt-4 rounded-full" onClick={() => router.push("/")}>
                Browse products
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {lines.map((line) => (
                  <div key={line.productId} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {line.image ? (
                        <img src={line.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{line.name}</p>
                      {line.shopName && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{line.shopName}</p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-brand">{formatKwacha(line.price)}</p>
                        <div className="flex items-center rounded-lg border border-border">
                          <button
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            onClick={() => setQuantity(line.productId, line.quantity - 1)}
                            aria-label={`Decrease quantity of ${line.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold">{line.quantity}</span>
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
                      className="self-start rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${line.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-xl font-bold text-brand">{formatKwacha(subtotal)}</p>
                </div>
                <Button className="h-11 rounded-full px-6 font-semibold" onClick={() => router.push("/checkout")}>
                  Checkout
                </Button>
              </div>
            </>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Heart className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold">Saved Items</h2>
            {saved.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {saved.length}
              </span>
            )}
          </div>

          {saved.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
              <p className="text-sm font-medium">Nothing saved yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tap the heart on any product while browsing to keep it here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {saved.map((product) => {
                const image = productImage(product);
                const line = cartLineFromProduct(product);
                return (
                  <div key={product.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
                      <p className="mt-0.5 text-sm font-bold text-brand">{formatKwacha(product.price)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 rounded-full px-3 text-xs"
                        disabled={!line || product.stock <= 0}
                        onClick={() => {
                          if (!line) {
                            toast.error("This product is not available to order right now.");
                            return;
                          }
                          addItem(line);
                          toast.success(`${product.name} added to cart`);
                        }}
                      >
                        Add to Cart
                      </Button>
                      <button
                        onClick={() => removeSaved(product.id)}
                        className="text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
