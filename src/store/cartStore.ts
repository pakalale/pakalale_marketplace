"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  name: string;
  image?: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  stock: number;
  shopId: string;
  shopName?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  /** Apply the latest price and stock the server reported at checkout. */
  syncLine: (productId: string, current: { price: number; stock: number }) => void;
  clearCart: () => void;
  clearShop: (shopId: string) => void;
}

const clampQuantity = (quantity: number, stock: number) => {
  const max = stock > 0 ? stock : 1;
  return Math.max(1, Math.min(quantity, max));
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((line) => line.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((line) =>
                line.productId === item.productId
                  ? { ...line, quantity: clampQuantity(line.quantity + quantity, line.stock) }
                  : line
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: clampQuantity(quantity, item.stock) }],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((line) => line.productId !== productId) })),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items
            .map((line) =>
              line.productId === productId
                ? { ...line, quantity: clampQuantity(quantity, line.stock) }
                : line
            )
            .filter((line) => line.quantity > 0),
        })),

      syncLine: (productId, { price, stock }) =>
        set((state) => ({
          items: state.items.map((line) =>
            line.productId === productId
              ? { ...line, price, stock, quantity: clampQuantity(line.quantity, stock) }
              : line
          ),
        })),

      clearCart: () => set({ items: [] }),

      clearShop: (shopId) =>
        set((state) => ({ items: state.items.filter((line) => line.shopId !== shopId) })),
    }),
    {
      name: "pakalale-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export const cartItemCount = (items: CartItem[]) =>
  items.reduce((total, line) => total + line.quantity, 0);

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((total, line) => total + line.price * line.quantity, 0);
