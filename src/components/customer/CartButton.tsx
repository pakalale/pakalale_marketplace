"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { cartItemCount, useCartStore } from "@/store/cartStore";

/**
 * Cart shortcut for pages that render their own compact header (locations,
 * shops) so the current basket stays one tap away while browsing.
 */
export default function CartButton() {
  const mounted = useHydrated();
  const count = useCartStore((state) => cartItemCount(state.items));
  const cartCount = mounted ? count : 0;

  return (
    <Link
      href="/customer/cart"
      aria-label={`Cart${cartCount ? `, ${cartCount} items` : ", empty"}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-brand transition-colors hover:bg-muted"
    >
      <ShoppingCart className="h-[18px] w-[18px]" />
      {cartCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
          {cartCount > 9 ? "9+" : cartCount}
        </span>
      )}
    </Link>
  );
}
