"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import toast from "react-hot-toast";
import ProductCard from "@/components/landing/ProductCard";
import ProductDetailModal from "@/components/ProductDetailModal";
import { useHydrated } from "@/hooks/useHydrated";
import type { ProductData } from "@/hooks/useApi";
import { cartLineFromProduct } from "@/lib/cart";
import { productShopName } from "@/lib/product";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

/** Products the visitor hearted, shared by /saved and /customer/saved. */
export default function SavedItems() {
  const addItem = useCartStore((state) => state.addItem);
  const savedItems = useWishlistStore((state) => state.items);
  const mounted = useHydrated();
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
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

  if (saved.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">Nothing saved yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Tap the heart on a product while browsing to keep it here.</p>
        <Link href="/#products" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{saved.length} saved {saved.length === 1 ? "product" : "products"}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
        {saved.map((product) => (
          <ProductCard key={product.id} product={product} onOpen={setSelectedProduct} onAddToCart={handleAddToCart} />
        ))}
      </div>
      {selectedProduct && (
        <ProductDetailModal
          isOpen
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          shopName={productShopName(selectedProduct)}
          primaryActionLabel="Add to Cart"
          onPrimaryAction={(product) => {
            handleAddToCart(product);
            setSelectedProduct(null);
          }}
        />
      )}
    </>
  );
}
