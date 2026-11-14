"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, LogIn, MapPin, Package, ShoppingBag, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Container from "@/components/landing/Container";
import DeliveryOptions from "@/components/cart/DeliveryOptions";
import { PageHeading } from "@/components/site/Breadcrumbs";
import { useAddresses } from "@/hooks/useAddresses";
import { deliveryOption, deliveryTotal } from "@/lib/delivery";
import { formatKwacha } from "@/lib/product";
import { loginHref } from "@/lib/authRedirect";
import { cn } from "@/lib/utils";
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

const NEW_ADDRESS = "new";

function OrderComplete({ placed, phone, pickup }: { placed: PlacedOrder[]; phone: string; pickup: boolean }) {
  return (
    <Container className="max-w-2xl py-6 sm:py-10">
      <PageHeading crumbs={[{ label: "Cart", href: "/cart" }, { label: "Order complete" }]} title="" />
      <div className="rounded-3xl border border-border bg-card p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-brand sm:text-3xl">
          {placed.length === 1 ? "Thank you! Your order is placed" : `Thank you! Your ${placed.length} orders are placed`}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          {placed.length === 1 ? "The shop" : "Each shop"} will contact you on <strong className="text-foreground">{phone}</strong>
          {pickup ? " when your order is ready to collect." : " to confirm delivery."} You pay in cash.
        </p>
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border text-left">
          {placed.map((order) => (
            <li key={order.id}>
              <Link href={`/customer/orders/${order.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{order.shopName}</p>
                  <p className="text-xs text-muted-foreground">Order #{order.id.slice(-6).toUpperCase()} · View details</p>
                </div>
                <p className="shrink-0 font-bold text-brand">{formatKwacha(order.total)}</p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/90">
            Continue Shopping <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/customer/orders" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-7 font-semibold text-brand hover:bg-muted">
            <Package className="h-4 w-4" /> View My Orders
          </Link>
        </div>
      </div>
    </Container>
  );
}

/** Checkout for everyone: guests are asked to sign in, with their cart kept. */
export default function CheckoutView() {
  const router = useRouter();
  const { user, isAuthenticated, hasCheckedSession, logout } = useAuthStore();
  const { items, removeItem, clearShop, syncLine, delivery, setDelivery } = useCartStore();
  const signedIn = isAuthenticated && Boolean(user);
  const { addresses, loading: addressesLoading, add: saveAddress } = useAddresses(signedIn);
  const [phoneInput, setPhone] = useState<string | null>(null);
  const [chosenAddress, setChosenAddress] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const [rememberAddress, setRememberAddress] = useState(true);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder[]>([]);
  const [errors, setErrors] = useState<Array<{ shop: string; message: string }>>([]);

  const option = deliveryOption(delivery);
  const needsAddress = option?.needsAddress ?? true;
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
  const addressChoice = chosenAddress ?? defaultAddress?.id ?? NEW_ADDRESS;
  const selectedAddress = addresses.find((address) => address.id === addressChoice);
  const phone = phoneInput ?? selectedAddress?.phone ?? user?.phone ?? "";

  // Grouped by shop: each shop gets its own order and delivery.
  const shops = useMemo(() => {
    const grouped = new Map<string, CartItem[]>();
    items.forEach((line) => grouped.set(line.shopId, [...(grouped.get(line.shopId) || []), line]));
    return Array.from(grouped, ([shopId, lines]) => ({
      shopId,
      lines,
      name: lines[0].shopName || "Local shop",
      subtotal: cartSubtotal(lines),
    }));
  }, [items]);

  useEffect(() => {
    if (placed.length > 0) window.scrollTo({ top: 0 });
  }, [placed.length]);

  const placeOrders = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    setPlacing(true);
    setErrors([]);

    const address = needsAddress ? (selectedAddress ? selectedAddress.details : newAddress.trim()) : "";
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
            subtotal: shop.subtotal,
            deliveryMethod: delivery,
            address,
            phone: phone.trim(),
            notes: note,
            paymentMethod: "Cash",
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

    if (succeeded.length > 0 && needsAddress && !selectedAddress && rememberAddress && address) {
      saveAddress({ label: "Home", details: address, phone: phone.trim() }).catch(() => {});
    }
    setPlaced((current) => [...current, ...succeeded]);
    setErrors(failed);
    setPlacing(false);
  };

  if (!hasCheckedSession) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
      </div>
    );
  }

  if (placed.length > 0 && items.length === 0) {
    return <OrderComplete placed={placed} phone={phone} pickup={!needsAddress} />;
  }

  if (items.length === 0) {
    return (
      <Container className="max-w-md py-10 text-center">
        <PageHeading crumbs={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} title="" />
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-brand">Your cart is empty</h1>
        <p className="mt-1 text-muted-foreground">Add a few products, then come back to check out.</p>
        <Link href="/#products" className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/90">
          Continue Shopping
        </Link>
      </Container>
    );
  }

  const subtotal = cartSubtotal(items);
  const fee = deliveryTotal(delivery, shops.length);

  return (
    <Container className="max-w-6xl py-6 sm:py-8">
      <PageHeading crumbs={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} title="Checkout" />

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

      <form onSubmit={placeOrders} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
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
                      {line.image ? <img src={line.image} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">{line.quantity} &times; {formatKwacha(line.price)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-brand">{formatKwacha(line.price * line.quantity)}</p>
                    <button
                      type="button"
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

          {signedIn && (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <DeliveryOptions value={delivery} onChange={setDelivery} shopCount={shops.length} />

              {needsAddress ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-brand" /> Deliver to</p>
                  {addressesLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-brand" />
                  ) : (
                    <div className="space-y-2">
                      {addresses.map((address) => (
                        <label
                          key={address.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm",
                            addressChoice === address.id ? "border-brand bg-brand/5" : "border-border"
                          )}
                        >
                          <input type="radio" name="address" className="mt-0.5 accent-[var(--brand)]" checked={addressChoice === address.id} onChange={() => setChosenAddress(address.id)} />
                          <span className="min-w-0">
                            <span className="block font-semibold">{address.label}{address.isDefault && <span className="ml-2 text-xs font-normal text-muted-foreground">Default</span>}</span>
                            <span className="block text-muted-foreground">{address.details}</span>
                          </span>
                        </label>
                      ))}
                      {addresses.length > 0 && (
                        <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm", addressChoice === NEW_ADDRESS ? "border-brand bg-brand/5" : "border-border")}>
                          <input type="radio" name="address" className="accent-[var(--brand)]" checked={addressChoice === NEW_ADDRESS} onChange={() => setChosenAddress(NEW_ADDRESS)} />
                          <span className="font-semibold">Use a different address</span>
                        </label>
                      )}
                      {addressChoice === NEW_ADDRESS && (
                        <div className="space-y-2">
                          <Input
                            aria-label="Delivery address"
                            required
                            value={newAddress}
                            onChange={(event) => setNewAddress(event.target.value)}
                            placeholder="Area, street, nearby landmark"
                          />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input type="checkbox" checked={rememberAddress} onChange={(event) => setRememberAddress(event.target.checked)} className="accent-[var(--brand)]" />
                            Save to my addresses
                          </label>
                        </div>
                      )}
                      <Link href="/customer/addresses" className="inline-block text-xs font-semibold text-brand hover:underline">Manage addresses</Link>
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                  You collect from {shops.length === 1 ? "the shop" : "each shop"}. They will tell you when your order is ready.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-phone">Phone number</Label>
                  <Input id="checkout-phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-note">Note for the shop (optional)</Label>
                  <Input id="checkout-note" value={note} onChange={(event) => setNote(event.target.value)} />
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-brand">Order Summary</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatKwacha(subtotal)}</span></div>
            <div className="flex justify-between">
              <span>Delivery · {option?.label}{shops.length > 1 && fee > 0 ? ` (${shops.length} shops)` : ""}</span>
              <span className="font-semibold">{fee === 0 ? "Free" : formatKwacha(fee)}</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-lg font-bold text-brand">Total</span>
            <span className="text-2xl font-bold text-brand">{formatKwacha(subtotal + fee)}</span>
          </div>

          {signedIn ? (
            <>
              <p className="text-xs text-muted-foreground">Pay in cash on delivery or at pickup.</p>
              <Button type="submit" disabled={placing} className="h-12 w-full rounded-xl text-sm font-semibold">
                {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {shops.length > 1 ? `Place ${shops.length} Orders` : "Place Order"}
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sign in to place your order. Your cart will be waiting.</p>
              <Button type="button" className="h-11 w-full rounded-xl text-sm font-semibold" onClick={() => router.push(loginHref("/checkout"))}>
                <LogIn className="mr-2 h-4 w-4" /> Sign In to Continue
              </Button>
              <Button type="button" variant="outline" className="h-11 w-full rounded-xl text-sm font-semibold" onClick={() => router.push(`/signup?next=${encodeURIComponent("/checkout")}`)}>
                Create an Account
              </Button>
            </div>
          )}
          <Link href="/cart" className="block text-center text-sm font-semibold text-brand hover:underline">Back to cart</Link>
        </aside>
      </form>
    </Container>
  );
}
