"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LogIn, ShoppingBag, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Container from "@/components/landing/Container";
import { formatKwacha } from "@/lib/product";
import { useAuthStore } from "@/store/authStore";
import { cartSubtotal, useCartStore, type CartItem } from "@/store/cartStore";

interface PlacedOrder {
  id: string;
  shopName: string;
  total: number;
}

interface CurrentLine {
  productId: string;
  price: number;
  stock: number;
  isAvailable: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, validateSession, logout } = useAuthStore();
  const { items, removeItem, clearShop, syncLine } = useCartStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [phoneInput, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder[]>([]);
  const [errors, setErrors] = useState<Array<{ shop: string; message: string }>>([]);

  // Also drops a stale saved login before it can be used to place an order.
  useEffect(() => {
    validateSession().finally(() => setSessionChecked(true));
  }, [validateSession]);

  const phone = phoneInput ?? user?.phone ?? "";

  // An order belongs to one shop, so the cart splits into one order per shop.
  const shops = useMemo(() => {
    const grouped = new Map<string, CartItem[]>();
    items.forEach((line) => grouped.set(line.shopId, [...(grouped.get(line.shopId) || []), line]));
    return Array.from(grouped, ([shopId, lines]) => ({
      shopId,
      lines,
      name: lines[0].shopName || "Local shop",
      total: cartSubtotal(lines),
    }));
  }, [items]);

  const placeOrders = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    setPlacing(true);
    setErrors([]);

    const notes = [`Phone: ${phone.trim()}`, `Deliver to: ${address.trim()}`, note.trim() && `Note: ${note.trim()}`]
      .filter(Boolean)
      .join("\n");

    const succeeded: PlacedOrder[] = [];
    const failed: Array<{ shop: string; message: string }> = [];

    // Shops are ordered independently: one failure must not lose or duplicate
    // another shop's order, so each success clears only that shop's lines.
    for (const shop of shops) {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: shop.shopId,
            items: shop.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
            total: shop.total,
            paymentMethod: "Cash",
            notes,
          }),
        });
        const data = await res.json();
        if (res.status === 401) {
          // Session ended mid-checkout: fall back to the sign-in panel, cart intact.
          logout();
          failed.push({ shop: shop.name, message: "Your session has ended. Please sign in again." });
          break;
        }
        if (!res.ok) {
          (data.current as CurrentLine[] | undefined)?.forEach((current) => {
            if (current.isAvailable) syncLine(current.productId, current);
          });
          failed.push({ shop: shop.name, message: data.error || "Could not place this order." });
          continue;
        }
        succeeded.push({ id: data.order.id, shopName: shop.name, total: data.order.total });
        clearShop(shop.shopId);
      } catch {
        failed.push({ shop: shop.name, message: "Network error. This order was not confirmed." });
      }
    }

    setPlaced((current) => [...current, ...succeeded]);
    setErrors(failed);
    setPlacing(false);
  };

  const goToAuth = (path: string) => {
    sessionStorage.setItem("redirectAfterLogin", "/checkout");
    router.push(path);
  };

  if (!sessionChecked) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
      </div>
    );
  }

  if (placed.length > 0 && items.length === 0) {
    return (
      <Container className="max-w-xl py-14 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-brand sm:text-3xl">
          {placed.length === 1 ? "Your order is placed" : `Your ${placed.length} orders are placed`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {placed.length === 1 ? "The shop" : "Each shop"} will contact you on {phone} to arrange delivery. You pay in cash.
        </p>
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card text-left">
          {placed.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{order.shopName}</p>
                <p className="text-xs text-muted-foreground">Order #{order.id.slice(-6).toUpperCase()}</p>
              </div>
              <p className="font-bold text-brand">{formatKwacha(order.total)}</p>
            </li>
          ))}
        </ul>
        <Link href="/customer/locations" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/90">
          Continue Shopping
        </Link>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="max-w-md py-20 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-brand">Your cart is empty</h1>
        <p className="mt-1 text-muted-foreground">Add a few products, then come back to check out.</p>
        <Link href="/customer/locations" className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/90">
          Browse Products
        </Link>
      </Container>
    );
  }

  const grandTotal = cartSubtotal(items);

  return (
    <Container className="py-6 sm:py-8">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-brand sm:text-3xl">Checkout</h1>

      {placed.length > 0 && (
        <div role="status" className="mb-4 rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm">
          Placed: {placed.map((order) => order.shopName).join(", ")}. The items below still need your attention.
        </div>
      )}
      {errors.length > 0 && (
        <div role="alert" className="mb-4 space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.map((error) => (
            <p key={error.shop}><strong>{error.shop}:</strong> {error.message}</p>
          ))}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {shops.map((shop) => (
            <section key={shop.shopId} className="rounded-2xl border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Store className="h-4 w-4 text-brand" /> {shop.name}
              </h2>
              <ul className="mt-3 divide-y divide-border">
                {shop.lines.map((line) => (
                  <li key={line.productId} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {line.image ? (
                        <img src={line.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.quantity} &times; {formatKwacha(line.price)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-brand">{formatKwacha(line.price * line.quantity)}</p>
                    <button
                      onClick={() => removeItem(line.productId)}
                      aria-label={`Remove ${line.name}`}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Total{shops.length > 1 ? ` (${shops.length} shops)` : ""}
            </span>
            <span className="text-2xl font-bold text-brand">{formatKwacha(grandTotal)}</span>
          </div>

          {user ? (
            <form onSubmit={placeOrders} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="checkout-phone">Phone number</Label>
                <Input id="checkout-phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checkout-address">Delivery address</Label>
                <Input id="checkout-address" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Area, street, nearby landmark" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checkout-note">Note (optional)</Label>
                <Input id="checkout-note" value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Pay in cash. Each shop contacts you to arrange delivery.
              </p>
              <Button type="submit" disabled={placing} className="h-11 w-full rounded-full text-sm font-semibold">
                {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {shops.length > 1 ? `Place ${shops.length} Orders` : "Place Order"}
              </Button>
            </form>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Sign in to place your order. Your cart will be waiting.
              </p>
              <Button className="h-11 w-full rounded-full text-sm font-semibold" onClick={() => goToAuth("/login")}>
                <LogIn className="mr-2 h-4 w-4" /> Sign In to Continue
              </Button>
              <Button variant="outline" className="h-11 w-full rounded-full text-sm font-semibold" onClick={() => goToAuth("/signup")}>
                Create an Account
              </Button>
            </div>
          )}
        </aside>
      </div>
    </Container>
  );
}
