"use client";

import { createElement, useState } from "react";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { formatKwacha, productDiscount, productImage, productShopName } from "@/lib/product";
import { cn } from "@/lib/utils";
import type { ProductData } from "@/hooks/useApi";
import { getCategoryIcon } from "./categoryIcon";

interface ProductCardProps {
  product: ProductData;
  onOpen: (product: ProductData) => void;
  onAddToCart: (product: ProductData) => void;
}

function Stars({ rating }: { rating: number }) {
  const row = (className: string) =>
    Array.from({ length: 5 }).map((_, index) => (
      <Star key={index} className={cn("h-3.5 w-3.5 shrink-0", className)} />
    ));
  return (
    <span className="relative inline-flex" role="img" aria-label={`Rated ${rating} out of 5`}>
      <span className="flex">{row("fill-muted text-muted")}</span>
      <span className="absolute inset-0 flex overflow-hidden" style={{ width: `${(rating / 5) * 100}%` }}>
        {row("fill-primary text-primary")}
      </span>
    </span>
  );
}

function compactCount(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(count);
}

export default function ProductCard({ product, onOpen, onAddToCart }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const saved = useWishlistStore((state) => state.items.some((item) => item.id === product.id));
  const toggleSaved = useWishlistStore((state) => state.toggle);

  const image = imageFailed ? undefined : productImage(product);
  const discount = productDiscount(product);
  const outOfStock = product.stock <= 0;
  const shopName = productShopName(product);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-3 shadow-[0_2px_12px_rgba(0,37,131,0.05)] transition-shadow hover:shadow-[0_8px_26px_rgba(0,37,131,0.12)] sm:p-4">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpen(product)}
          aria-label={`View ${product.name}`}
          className="block aspect-square w-full overflow-hidden rounded-xl bg-white"
        >
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-[#edf0f9]">
              {createElement(getCategoryIcon(product.category || ""), {
                className: "h-14 w-14 text-[#002583]/30",
                strokeWidth: 1.4,
              })}
            </span>
          )}
        </button>

        {discount > 0 && (
          <span className="absolute left-0 top-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
            -{discount}%
          </span>
        )}

        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name}`}
          onClick={() => toggleSaved(product)}
          className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-sm transition-colors hover:text-rose-500"
        >
          <Heart className={cn("h-4 w-4", saved && "fill-rose-500 text-rose-500")} />
        </button>
      </div>

      <div className="mt-3 flex flex-1 flex-col">
        {shopName && <p className="truncate text-xs text-muted-foreground">{shopName}</p>}
        <button
          type="button"
          onClick={() => onOpen(product)}
          className="line-clamp-2 text-left text-sm font-semibold leading-snug text-foreground hover:text-brand sm:text-[15px]"
        >
          {product.name}
        </button>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold text-brand sm:text-xl">{formatKwacha(product.price)}</span>
          {discount > 0 && product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through sm:text-sm">
              {formatKwacha(product.originalPrice)}
            </span>
          )}
        </div>

        {/* New products default to a rating of 5, so only show earned ratings. */}
        <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {product.reviews > 0 ? (
            <>
              <Stars rating={product.rating} />
              <span>
                {product.rating} ({compactCount(product.reviews)})
              </span>
            </>
          ) : (
            <span>No reviews yet</span>
          )}
        </div>

        <button
          type="button"
          disabled={outOfStock}
          onClick={() => onAddToCart(product)}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {!outOfStock && <ShoppingCart className="h-4 w-4" />}
          {outOfStock ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </article>
  );
}
