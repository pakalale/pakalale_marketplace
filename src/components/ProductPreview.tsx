"use client";

import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import ImageWithFallback from "@/components/ImageWithFallback";
import { productPlaceholder } from "@/lib/placeholders";
import type { ProductData } from "@/hooks/useApi";

interface ProductPreviewProps {
  products: ProductData[];
  onSelect: (product: ProductData) => void;
  /** Maximum thumbnails to show (3 per row). Anything beyond is collapsed into a +N tile. */
  max?: number;
  /** Show the price tag on each thumbnail. */
  showPrice?: boolean;
  className?: string;
  emptyLabel?: string;
}

/**
 * Compact product image strip used across the platform (locations, shops,
 * trending cards) so customers keep seeing what shops actually sell.
 * Clicking a thumbnail hands the full product back to the caller, which
 * decides where the product opens.
 */
export default function ProductPreviewStrip({
  products,
  onSelect,
  max = 9,
  showPrice = false,
  className,
  emptyLabel,
}: ProductPreviewProps) {
  const withImages = products;
  // Always a fixed 3-column grid; extra products wrap into new rows.
  const limit = Math.max(1, max);
  const hasOverflow = withImages.length > limit;
  const visible = withImages.slice(0, hasOverflow ? limit - 1 : limit);
  const remaining = withImages.length - visible.length;
  const usedImageUrls = new Set<string>();
  const visibleProducts = visible.map((product) => {
    const uploadedImage = product.images?.find((image) => image && !usedImageUrls.has(image));
    const image = uploadedImage || productPlaceholder(product.category, product.id, [...usedImageUrls]);
    usedImageUrls.add(image);
    const fallback = productPlaceholder(product.category, `${product.id}-fallback`, [...usedImageUrls]);
    usedImageUrls.add(fallback);
    return { product, image, fallback };
  });

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

  return (
    <div className={cn("grid w-full max-w-[288px] grid-cols-3 gap-1.5", className)}>
      {visibleProducts.map(({ product, image, fallback }) => (
        <button
          key={product.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(product);
          }}
          aria-label={`View ${product.name}`}
          title={product.name}
          className="group relative aspect-square w-full overflow-hidden rounded-md border border-border bg-muted transition-all hover:border-brand/50 hover:ring-2 hover:ring-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ImageWithFallback
            src={image}
            fallbackSrc={fallback}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {showPrice && (
            <span className="absolute inset-x-0 bottom-0 truncate bg-brand/90 px-1 py-0.5 text-[9px] font-semibold text-brand-foreground">
              K{product.price.toLocaleString()}
            </span>
          )}
        </button>
      ))}
      {remaining > 0 && (
        <span className="flex aspect-square w-full items-center justify-center rounded-md border border-brand/20 bg-brand-soft text-[10px] font-semibold text-brand">
          +{remaining}
        </span>
      )}
    </div>
  );
}
