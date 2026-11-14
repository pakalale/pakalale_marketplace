"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Info, Lock, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { deliveryOption, deliveryTotal } from "@/lib/delivery";
import { formatKwacha } from "@/lib/product";
import { cn } from "@/lib/utils";
import { cartItemCount, cartShopCount, cartSubtotal, useCartStore, type CartItem } from "@/store/cartStore";
import DeliveryOptions from "./DeliveryOptions";

function Stepper({ line }: { line: CartItem }) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const button = "flex h-7 w-7 items-center justify-center rounded-md bg-brand-soft text-brand transition-colors hover:bg-brand-muted disabled:opacity-40 dark:bg-muted";
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" className={button} disabled={line.quantity <= 1} onClick={() => setQuantity(line.productId, line.quantity - 1)} aria-label={`One less ${line.name}`}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-5 text-center text-sm font-semibold" aria-live="polite">{line.quantity}</span>
      <button type="button" className={button} disabled={line.quantity >= line.stock} onClick={() => setQuantity(line.productId, line.quantity + 1)} aria-label={`One more ${line.name}`}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Cart rows with quantity steppers and remove buttons. */
export function CartLines({ items, className }: { items: CartItem[]; className?: string }) {
  const removeItem = useCartStore((state) => state.removeItem);
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {items.map((line) => (
        <li key={line.productId} className="flex items-center gap-3 py-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f4f6fb] dark:bg-muted">
            {line.image ? <img src={line.image} alt="" className="h-full w-full object-contain" /> : <ShoppingBag className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="line-clamp-1 text-sm font-semibold">{line.name}</p>
            <p className="text-sm font-bold text-brand">{formatKwacha(line.price)}</p>
            <Stepper line={line} />
          </div>
          <button
            type="button"
            onClick={() => removeItem(line.productId)}
            aria-label={`Remove ${line.name}`}
            className="shrink-0 rounded-lg p-1.5 text-brand transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Subtotal, delivery choice, total and the way on to checkout. */
export function CartSummary({ onContinue }: { onContinue?: () => void }) {
  const router = useRouter();
  const { items, delivery, setDelivery } = useCartStore();
  const shops = cartShopCount(items);
  const subtotal = cartSubtotal(items);
  const fee = deliveryTotal(delivery, shops);
  const option = deliveryOption(delivery);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="font-semibold">Subtotal</span>
          <span className="font-bold">{formatKwacha(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5 font-semibold">
            Delivery
            <span title="Charged per shop. Pickup is free." className="text-muted-foreground">
              <Info className="h-3.5 w-3.5" aria-label="Charged per shop. Pickup is free." />
            </span>
          </span>
          <span className="font-bold">
            {fee === 0 ? "Free" : formatKwacha(fee)}
            {shops > 1 && option && option.fee > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">({shops} × {formatKwacha(option.fee)})</span>}
          </span>
        </div>
      </div>

      <DeliveryOptions value={delivery} onChange={setDelivery} shopCount={shops} />

      <div className="flex items-baseline justify-between pt-1">
        <span className="text-xl font-bold text-brand">Total</span>
        <span className="text-2xl font-bold text-brand">{formatKwacha(subtotal + fee)}</span>
      </div>

      <button
        type="button"
        onClick={() => router.push("/checkout")}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <Lock className="h-4 w-4" /> Proceed to Checkout <ArrowRight className="h-4 w-4" />
      </button>
      {onContinue ? (
        <button type="button" onClick={onContinue} className="block w-full text-center text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Continue Shopping
        </button>
      ) : (
        <Link href="/#products" className="block text-center text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Continue Shopping
        </Link>
      )}
    </div>
  );
}

/** The live cart beside the product grid on the home page. */
export default function CartPanel({ className }: { className?: string }) {
  const mounted = useHydrated();
  const items = useCartStore((state) => state.items);
  const count = mounted ? cartItemCount(items) : 0;

  return (
    <aside aria-label="Your shopping cart" className={cn("rounded-2xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(0,37,131,0.06)]", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-brand">
          <ShoppingCart className="h-6 w-6" /> Your Shopping Cart
        </h2>
        <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand dark:bg-muted">
          {count} {count === 1 ? "Item" : "Items"}
        </span>
      </div>

      {!mounted || items.length === 0 ? (
        <div className="py-10 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Your cart is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Add products and they will show up here.</p>
        </div>
      ) : (
        <>
          <CartLines items={items} className="max-h-[22rem] overflow-y-auto" />
          <div className="border-t border-border pt-3">
            <CartSummary onContinue={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })} />
          </div>
        </>
      )}
    </aside>
  );
}
