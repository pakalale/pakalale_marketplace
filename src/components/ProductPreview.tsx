"use client";

import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/landing/ProductCard";
import type { ProductData } from "@/hooks/useApi";

interface ProductPreviewProps {
  products: ProductData[];
  onSelect: (product: ProductData) => void;
  /** Maximum products to show. */
  max?: number;
  layout?: "horizontal" | "grid" | "carousel";
  compact?: boolean;
  onAddToCart: (product: ProductData) => void;
  cardClassName?: string;
  className?: string;
  emptyLabel?: string;
}

/**
 * Product cards shared by location and trending-shop previews.
 */
export default function ProductPreviewStrip({
  products,
  onSelect,
  onAddToCart,
  max = 9,
  layout = "horizontal",
  compact = false,
  cardClassName,
  className,
  emptyLabel,
}: ProductPreviewProps) {
  const limit = Math.max(1, max);
  const visible = products.slice(0, limit);

  if (visible.length === 0) {
    if (!emptyLabel) return null;
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/40 py-3 text-[10px] text-muted-foreground",
          className
        )}
      >
        <ShoppingBag className="h-3 w-3" />
        {emptyLabel}
      </div>
    );
  }

  if (layout === "carousel") {
    const pages = Array.from({ length: Math.ceil(visible.length / 2) }, (_, index) =>
      visible.slice(index * 2, index * 2 + 2)
    );

    return (
      <div
        role="region"
        aria-label="Shop products"
        className={cn(
          "flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:thin]",
          className
        )}
      >
        {pages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className={cn(
              "grid w-full min-w-full shrink-0 snap-start items-stretch gap-2",
              page.length === 1 ? "grid-cols-1" : "grid-cols-2"
            )}
          >
            {page.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={onSelect}
                onAddToCart={onAddToCart}
                className={cn("w-full min-w-0", cardClassName)}
                compact={compact}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      layout === "grid"
        ? "grid w-full grid-cols-2 gap-2"
        : "flex w-full gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]",
      className
    )}>
      {visible.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onOpen={onSelect}
          onAddToCart={onAddToCart}
          className={cn(
            layout === "grid" ? "w-full min-w-0" : "w-[min(100%,168px)] min-w-[144px] shrink-0",
            cardClassName
          )}
        />
      ))}
    </div>
  );
}
