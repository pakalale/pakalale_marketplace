"use client";

import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import toast from "react-hot-toast";
import Container from "@/components/landing/Container";
import { cartLineFromProduct } from "@/lib/cart";
import ProductCard from "@/components/landing/ProductCard";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/useHydrated";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import type { ProductData } from "@/hooks/useApi";

export default function CustomerSavedPage() {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const savedItems = useWishlistStore((state) => state.items);
  const mounted = useHydrated();
  const saved = mounted ? savedItems : [];

  const handleAddToCart = (product: ProductData) => {
    const line = cartLineFromProduct(product);
    if (!line) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem(line);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-brand">
            <Heart className="h-5 w-5" /> Saved Items
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {saved.length === 0 ? "Nothing saved yet" : `${saved.length} saved ${saved.length === 1 ? "product" : "products"}`}
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/")}>Continue shopping</Button>
      </div>

      {saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Tap the heart on a product while browsing to keep it here.</p>
          <Button className="mt-4 rounded-full" onClick={() => router.push("/")}>Browse products</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {saved.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={() => {}}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full h-11 rounded-full text-sm font-medium"
          onClick={() => router.push("/cart")}
        >
          View cart (checkout)
        </Button>
      </div>
    </Container>
  );
}