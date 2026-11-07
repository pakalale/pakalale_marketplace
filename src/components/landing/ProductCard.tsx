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
  className?: string;
  compact?: boolean;
  imageOverride?: string | null;
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

export default function ProductCard({ product, onOpen, onAddToCart, className, compact = false, imageOverride }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const saved = useWishlistStore((state) => state.items.some((item) => item.id === product.id));
  const toggleSaved = useWishlistStore((state) => state.toggle);

  const image = imageFailed
    ? undefined
    : imageOverride === undefined
      ? productImage(product)
      : imageOverride || undefined;
  const discount = productDiscount(product);
  const outOfStock = product.stock <= 0;
  const shopName = productShopName(product);

  return (
    <article className={cn(
      "group flex h-full flex-col rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(0,37,131,0.05)] transition-shadow hover:shadow-[0_8px_26px_rgba(0,37,131,0.12)]",
      compact ? "p-2" : "p-3 sm:p-4",
      className
    )}>
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(product);
          }}
          aria-label={`View ${product.name}`}
          className={cn(
            "block w-full overflow-hidden rounded-xl bg-white",
            compact ? "h-16" : "aspect-square"
          )}
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
          onClick={(event) => {
            event.stopPropagation();
            toggleSaved(product);
          }}
          className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-sm transition-colors hover:text-rose-500"
        >
          <Heart className={cn("h-4 w-4", saved && "fill-rose-500 text-rose-500")} />
        </button>
      </div>

      <div className={cn("flex flex-1 flex-col", compact ? "mt-1.5" : "mt-3")}>
        {!compact && <p className="h-4 truncate text-xs leading-4 text-muted-foreground">
          {shopName || <span aria-hidden="true">&nbsp;</span>}
        </p>}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(product);
          }}
          className={cn(
            "line-clamp-2 text-left font-semibold leading-5 text-foreground hover:text-brand",
            compact ? "min-h-9 text-xs" : "min-h-10 text-sm sm:text-[15px]"
          )}
        >
          {product.name}
        </button>

        <div className={cn("mt-1.5 flex min-h-6 flex-wrap items-baseline gap-x-2", compact && "mt-1 min-h-5")}>
          <span className={cn("font-bold text-brand", compact ? "text-sm" : "text-lg sm:text-xl")}>{formatKwacha(product.price)}</span>
          {discount > 0 && product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through sm:text-sm">
              {formatKwacha(product.originalPrice)}
            </span>
          )}
        </div>

        {/* New products default to a rating of 5, so only show earned ratings. */}
        {!compact && <div className="mt-1 flex h-5 shrink-0 flex-wrap items-center gap-1 overflow-hidden text-xs text-muted-foreground">
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
        </div>}

        <button
          type="button"
          disabled={outOfStock}
          onClick={(event) => {
            event.stopPropagation();
            onAddToCart(product);
          }}
          className={cn(
            "mt-auto flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
            compact ? "h-8 text-[10px]" : "mt-3 h-10 gap-2 text-sm"
          )}
        >
          {!outOfStock && <ShoppingCart className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />}
          {outOfStock ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </article>
  );
}
