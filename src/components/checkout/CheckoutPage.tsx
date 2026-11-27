"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  LogIn,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
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

interface DeliveryQuoteInfo {
  quoteId: string;
  shopId: string;
  fee: number;
  distanceKm: number;
  etaMinutes: number;
  currency: string;
  expiresAt: string;
}

type QuoteState =
  | { status: "loading" }
  | { status: "ready"; quote: DeliveryQuoteInfo }
  | { status: "error"; error: string };

type DeliveryMethod = "yango" | "pickup";
type PaymentMethod = "airtel_money" | "cash";

const DELIVERY_OPTIONS: Array<{
  id: DeliveryMethod;
  label: string;
  detail: string;
  image?: string;
}> = [
  { id: "yango", label: "Yango", detail: "Courier collects from the shop and delivers to you", image: "/yango-logo.png" },
  { id: "pickup", label: "Pickup from shop", detail: "Collect and pay cash at the shop", image: undefined },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { user, validateSession, logout } = useAuthStore();
  const { items, clearShop, syncLine } = useCartStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [phoneInput, setPhone] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [note, setNote] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("yango");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder[]>([]);
  const [errors, setErrors] = useState<Array<{ shop: string; message: string }>>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});
  const [quoteNonce, setQuoteNonce] = useState(0);

  // Also drops a stale saved login before it can be used to place an order.
  useEffect(() => {
    validateSession().finally(() => setSessionChecked(true));
  }, [validateSession]);

  const phone = phoneInput ?? user?.phone ?? "";
  const address = addressInput || user?.defaultAddress || "";
  const isPickup = deliveryMethod === "pickup";
  // Pickup is always cash on collection; delivery is paid into escrow.
  const paymentMethod: PaymentMethod = isPickup ? "cash" : "airtel_money";

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


  /**
   * Price the courier before the customer commits. One quote per shop; the
   * signed quote is sent with each order and re-checked on the server.
   */
  useEffect(() => {
    if (isPickup || shops.length === 0 || !address.trim()) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      setQuotes(
        Object.fromEntries(shops.map((shop) => [shop.shopId, { status: "loading" } as QuoteState]))
      );
      try {
        const response = await fetch("/api/delivery/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopIds: shops.map((shop) => shop.shopId),
            provider: "yango",
            deliveryAddress: address,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not calculate the delivery price");
        if (cancelled) return;
        const next: Record<string, QuoteState> = {};
        (data.quotes as DeliveryQuoteInfo[] | undefined)?.forEach((quote) => {
          next[quote.shopId] = { status: "ready", quote };
        });
        shops.forEach((shop) => {
          if (!next[shop.shopId]) {
            next[shop.shopId] = { status: "error", error: "No price for this shop" };
          }
        });
        setQuotes(next);
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : "Could not calculate the delivery price";
        setQuotes(
          Object.fromEntries(shops.map((shop) => [shop.shopId, { status: "error", error: message }]))
        );
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, isPickup, shops, quoteNonce]);

  const quoteReady =
    isPickup ||
    (shops.length > 0 &&
      Boolean(address.trim()) &&
      shops.every((shop) => quotes[shop.shopId]?.status === "ready"));
  const deliveryTotal = isPickup
    ? 0
    : shops.reduce((sum, shop) => {
        const state = quotes[shop.shopId];
        return sum + (state?.status === "ready" ? state.quote.fee : 0);
      }, 0);

  const placeOrders = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    if (!quoteReady) {
      setErrors([{ shop: "Delivery", message: "Wait for the courier price before placing the order." }]);
      return;
    }
    setPlacing(true);
    setErrors([]);

    const notes = [note.trim() && `Note: ${note.trim()}`].filter(Boolean).join("\n");

    const succeeded: PlacedOrder[] = [];
    const failed: Array<{ shop: string; message: string }> = [];
    let quoteExpired = false;

    // Shops are ordered independently: one failure must not lose or duplicate
    // another shop's order, so each success clears only that shop's lines.
    for (const shop of shops) {
      try {
        const quote = quotes[shop.shopId];
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: shop.shopId,
            items: shop.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
            subtotal: shop.total,
            deliveryMethod,
            paymentMethod,
            customerPhone: phone.trim(),
            deliveryAddress: isPickup ? "" : address.trim(),
            notes,
            deliveryQuoteId: quote?.status === "ready" ? quote.quote.quoteId : undefined,
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
          if (data.code === "DELIVERY_QUOTE_EXPIRED") quoteExpired = true;
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
    if (quoteExpired) setQuoteNonce((value) => value + 1);
    setPlacing(false);
  };

  const goToAuth = (path: string) => {
    sessionStorage.setItem("redirectAfterLogin", "/customer");
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
          {isPickup
            ? "Pay cash when you collect. The shop will confirm the order and send you their map pin."
            : "The shop will confirm your order, then a Yango courier is booked to collect and deliver it."}
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
        <Link href="/customer/orders" className="mt-5 inline-flex h-11 items-center rounded-full border border-border px-6 font-semibold text-brand hover:bg-muted">
          View my orders
        </Link>
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

  const subtotal = cartSubtotal(items);
  const grandTotal = subtotal + deliveryTotal;
  const firstQuoteState = shops.length > 0 ? quotes[shops[0].shopId] : undefined;

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
          {shops.map((shop) => {
            const quoteState = quotes[shop.shopId];
            return (
              <section key={shop.shopId} className="rounded-2xl border border-border bg-card p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Store className="h-4 w-4 text-brand" /> {shop.name}
                </h2>
                <ul className="mt-3 divide-y divide-border">
                  {shop.lines.map((line) => (
                    <li key={line.productId} className="flex items-center gap-3 py-2.5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {line.image ? (
                          <Image src={line.image} alt="" width={56} height={56} className="h-full w-full object-cover" />
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
                    </li>
                  ))}
                </ul>
                {!isPickup && quoteState?.status === "ready" && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-brand/5 px-3 py-2 text-xs text-muted-foreground">
                    <Truck className="h-4 w-4 text-brand" />
                    Yango · {quoteState.quote.distanceKm} km · ~{quoteState.quote.etaMinutes} min
                    <span className="ml-auto font-semibold text-brand">{formatKwacha(quoteState.quote.fee)}</span>
                  </p>
                )}
              </section>
            );
          })}
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
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Delivery option</legend>
                {DELIVERY_OPTIONS.map((option) => {
                  const active = deliveryMethod === option.id;
                  const quoteState = quotes[shops[0]?.shopId];
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${active ? "border-brand bg-brand/5" : "border-border hover:bg-muted/50"}`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value={option.id}
                        checked={active}
                        onChange={() => setDeliveryMethod(option.id)}
                        className="accent-primary"
                      />
                      {option.image ? (
                        <Image src={option.image} alt="" width={76} height={36} className="h-7 w-[58px] shrink-0 object-contain" />
                      ) : (
                        <span className="flex h-8 w-[58px] shrink-0 items-center justify-center text-brand"><Store className="h-5 w-5" /></span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.detail}</span>
                        {option.id === "yango" && active && (
                          <span className="mt-1 block text-[11px] font-medium">
                            {!address.trim() ? (
                              <span className="text-muted-foreground">Add your address to see the price</span>
                            ) : quoteState?.status === "loading" ? (
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> Calculating courier price…
                              </span>
                            ) : quoteState?.status === "error" ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  setQuoteNonce((value) => value + 1);
                                }}
                                className="inline-flex items-center gap-1 text-destructive underline underline-offset-2"
                              >
                                <RefreshCw className="h-3 w-3" /> Price unavailable — retry
                              </button>
                            ) : quoteState?.status === "ready" ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {formatKwacha(quoteState.quote.fee)}
                                {shops.length > 1 ? " per shop" : ""} · {quoteState.quote.distanceKm} km · ~{quoteState.quote.etaMinutes} min
                              </span>
                            ) : null}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-semibold">
                        {option.id === "pickup"
                          ? "Free"
                          : firstQuoteState?.status === "ready"
                            ? formatKwacha(firstQuoteState.quote.fee)
                            : "—"}
                      </span>
                    </label>
                  );
                })}
                {!isPickup && (
                  <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    This is the courier price you are confirming. It is held with your payment and released after you
                    confirm the parcel arrived.
                  </p>
                )}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Payment method</legend>
                {isPickup ? (
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-brand bg-brand/5 p-3">
                    <input type="radio" name="paymentMethod" value="cash" checked readOnly className="accent-primary" />
                    <span className="flex h-8 w-[72px] shrink-0 items-center justify-center text-brand"><Wallet className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">Cash at pickup</span>
                      <span className="block text-xs text-muted-foreground">Pay the shop when you collect</span>
                    </span>
                  </label>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-brand bg-brand/5 p-3">
                    <input type="radio" name="paymentMethod" value="airtel_money" checked readOnly className="accent-primary" />
                    <Image src="/Airtel_Africa-Logo.wine.png" alt="Airtel Money" width={90} height={36} className="h-8 w-[72px] shrink-0 object-contain" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">Airtel Money</span>
                      <span className="block text-xs text-muted-foreground">Payment held until you confirm delivery</span>
                    </span>
                  </label>
                )}
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="checkout-phone">Phone number</Label>
                <Input id="checkout-phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
              {!isPickup && (
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-address"><MapPin className="mr-1 inline h-4 w-4" />Delivery address</Label>
                  <Input id="checkout-address" required value={address} onChange={(event) => setAddressInput(event.target.value)} placeholder="Area, street, nearby landmark" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="checkout-note">Note (optional)</Label>
                <Input id="checkout-note" value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
              <div className="space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatKwacha(subtotal)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery{shops.length > 1 ? ` × ${shops.length}` : ""}</span>
                  <span>{isPickup ? "Free" : deliveryTotal ? formatKwacha(deliveryTotal) : "—"}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span className="text-brand">{formatKwacha(grandTotal)}</span></div>
                {!isPickup && (
                  <p className="text-[11px] text-muted-foreground">Payment processed now. The shop is paid when you confirm receipt; Yango delivery fee at the same time.
                  </p>
                )}
              </div>
              <Button type="submit" disabled={placing || !quoteReady} className="h-11 w-full rounded-full text-sm font-semibold">
                {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!quoteReady && !isPickup
                  ? "Waiting for courier price…"
                  : shops.length > 1
                    ? `Place ${shops.length} Orders`
                    : "Place Order"}
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
