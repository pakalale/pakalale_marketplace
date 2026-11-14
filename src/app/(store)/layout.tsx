"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CartSheet from "@/components/landing/CartSheet";
import Footer from "@/components/landing/Footer";
import GuestAccountPrompt from "@/components/landing/GuestAccountPrompt";
import StoreHeader from "@/components/landing/StoreHeader";
import WishlistSheet from "@/components/landing/WishlistSheet";
import { useHydrated } from "@/hooks/useHydrated";
import { useAuthStore } from "@/store/authStore";
import { cartItemCount, useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const cartItems = useCartStore((state) => state.items);
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const { isAuthenticated, user, validateSession } = useAuthStore();
  const [sessionState, setSessionState] = useState<"unknown" | "valid" | "invalid">("unknown");
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  // Persisted stores only exist in the browser, so counts wait for hydration.
  const mounted = useHydrated();
  const isShoppingUtility = ["/cart", "/checkout", "/saved"].includes(pathname);

  // Check the saved login with the server before acting on it. An expired
  // session clears itself here, so the visitor stays on the public store
  // instead of bouncing between their dashboard and the sign-in page.
  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    let active = true;
    validateSession().then((valid) => {
      if (active) setSessionState(valid ? "valid" : "invalid");
    });
    return () => {
      active = false;
    };
  }, [mounted, isAuthenticated, validateSession]);

  // Signed-in people get their own area. Customers keep the same cart,
  // checkout and saved pages there (/customer/cart ...) instead of the
  // public storefront versions, so they never drop back into the landing page.
  const accountPath = user && sessionState === "valid"
    ? user.role === "admin"
      ? isShoppingUtility ? null : "/admin"
      : user.role === "shop_owner"
        ? isShoppingUtility ? null : "/shop/feed"
        : isShoppingUtility ? `/customer${pathname}` : "/customer"
    : null;

  useEffect(() => {
    if (mounted && isAuthenticated && accountPath) router.replace(accountPath);
  }, [accountPath, isAuthenticated, mounted, router]);

  // Visitors can browse, search and fill a cart. Only checkout requires an account.
  const handleCheckout = () => {
    if (!mounted) return;
    setCartOpen(false);
    if (!isAuthenticated) {
      setGuestPromptOpen(true);
      return;
    }
    router.push("/checkout");
  };

  // Render nothing while a saved login is being checked or redirected, so the
  // public storefront does not flash for signed-in people.
  if (mounted && isAuthenticated && (sessionState === "unknown" || accountPath)) return null;

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
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} onCheckout={handleCheckout} />
      <WishlistSheet open={wishlistOpen} onOpenChange={setWishlistOpen} />
      <GuestAccountPrompt open={guestPromptOpen} onOpenChange={setGuestPromptOpen} />
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href="/customer" className="transition-colors hover:text-foreground">
              Customer
            </Link>
            <Link href="/customer/orders" className="transition-colors hover:text-foreground">
              Orders
            </Link>
            <Link href="/customer/settings" className="transition-colors hover:text-foreground">
              Settings
            </Link>
            <Link href="/shop" className="transition-colors hover:text-foreground">
              Shop
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
