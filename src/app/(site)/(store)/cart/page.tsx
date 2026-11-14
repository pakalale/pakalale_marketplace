"use client";

import Link from "next/link";
import { ShoppingBag, Store } from "lucide-react";
import Container from "@/components/landing/Container";
import { CartLines, CartSummary } from "@/components/cart/CartPanel";
import { PageHeading } from "@/components/site/Breadcrumbs";
import { useHydrated } from "@/hooks/useHydrated";
import { cartItemCount, useCartStore, type CartItem } from "@/store/cartStore";

export default function CartPage() {
  const mounted = useHydrated();
  const items = useCartStore((state) => state.items);
  const lines = mounted ? items : [];
  const count = cartItemCount(lines);

  const shops = new Map<string, CartItem[]>();
  lines.forEach((line) => shops.set(line.shopId, [...(shops.get(line.shopId) || []), line]));

  return (
    <Container className="max-w-6xl py-6 sm:py-8">
      <PageHeading crumbs={[{ label: "Cart" }]} title="Your Shopping Cart">
        <p className="text-sm text-muted-foreground">{count === 0 ? "Nothing here yet" : `${count} ${count === 1 ? "item" : "items"}`}</p>
      </PageHeading>

      {lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-semibold">Your cart is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Browse the store and add a few products.</p>
          <Link href="/#products" className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/90">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {[...shops].map(([shopId, shopLines]) => (
              <section key={shopId} className="rounded-2xl border border-border bg-card px-4 pt-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Store className="h-4 w-4 text-brand" /> {shopLines[0].shopName || "Local shop"}
                </h2>
                <CartLines items={shopLines} />
              </section>
            ))}
          </div>
          <aside className="rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-24">
            <CartSummary />
          </aside>
        </div>
      )}
    </Container>
  );
}
