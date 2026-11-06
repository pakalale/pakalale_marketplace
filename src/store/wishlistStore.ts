"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductData } from "@/hooks/useApi";

interface WishlistState {
  items: ProductData[];
  toggle: (product: ProductData) => boolean;
  remove: (productId: string) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      /** Returns true when the product was added. */
      toggle: (product) => {
        const exists = get().items.some((item) => item.id === product.id);
        set((state) => ({
          items: exists
            ? state.items.filter((item) => item.id !== product.id)
            : [product, ...state.items],
        }));
        return !exists;
      },
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== productId) })),
    }),
    { name: "pakalale-wishlist" }
  )
);
