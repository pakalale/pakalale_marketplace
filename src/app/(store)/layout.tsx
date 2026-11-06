"use client";

import { useState } from "react";
import CartSheet from "@/components/landing/CartSheet";
import Footer from "@/components/landing/Footer";
import StoreHeader from "@/components/landing/StoreHeader";
import WishlistSheet from "@/components/landing/WishlistSheet";
import { useHydrated } from "@/hooks/useHydrated";
import { cartItemCount, useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const cartItems = useCartStore((state) => state.items);
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  // Persisted stores only exist in the browser, so counts wait for hydration.
  const mounted = useHydrated();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StoreHeader
        cartCount={mounted ? cartItemCount(cartItems) : 0}
        wishlistCount={mounted ? wishlistCount : 0}
        onCartOpen={() => setCartOpen(true)}
        onWishlistOpen={() => setWishlistOpen(true)}
      />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
      <WishlistSheet open={wishlistOpen} onOpenChange={setWishlistOpen} />
    </div>
  );
}
