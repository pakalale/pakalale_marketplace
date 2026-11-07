"use client";

import { useState, useEffect } from "react";
import { useModalBack } from "@/hooks/useModalBack";
import { ShoppingBag, Star, Package, Store, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cloudflareStreamPlayerUrl, isProductVideo, productDiscount } from "@/lib/product";
import ImageWithFallback from "@/components/ImageWithFallback";
import ImageViewerModal from "@/components/ImageViewerModal";
import { productPlaceholder } from "@/lib/placeholders";
import type { ProductData } from "@/hooks/useApi";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductData;
  shopName?: string;
  /** Legacy deal action. Used when no custom primary action is supplied. */
  onMakeDeal?: (product: ProductData) => void;
  /** Public storefront action, e.g. Add to Cart. */
  primaryActionLabel?: string;
  onPrimaryAction?: (product: ProductData) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: (product: ProductData) => void;
  secondaryActionDisabled?: boolean;
}

export default function ProductDetailModal({
  isOpen,
  onClose,
  product,
  shopName,
  onMakeDeal,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled,
}: ProductDetailModalProps) {
  useModalBack(isOpen, onClose);

  const [imageIndex, setImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Track product view when modal opens
  useEffect(() => {
    if (isOpen && product?.id) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "product_view", targetId: product.id, source: "feed" }),
      }).catch(() => {});
    }
  }, [isOpen, product?.id]);

  const productMedia = product.images?.map((url) => url.trim()).filter(Boolean) || [];
  const fallbackImage = productPlaceholder(product.category, product.id);
  const images = productMedia.length > 0 ? productMedia : [fallbackImage];
  const imageIndexInRange = Math.min(imageIndex, images.length - 1);

  const nextImage = () => {
    setImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const discount = productDiscount(product);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent overlayClassName="z-[70]" className="z-[70] w-[calc(100vw-1rem)] max-w-md p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col sm:w-full rounded-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 bg-background/80 backdrop-blur rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image Slider */}
        <div className="relative shrink-0 bg-muted aspect-[4/3] overflow-hidden">
          {isProductVideo(images[imageIndexInRange]) ? (
            cloudflareStreamPlayerUrl(images[imageIndexInRange]) ? (
              <iframe
                src={cloudflareStreamPlayerUrl(images[imageIndexInRange])!}
                title={`${product.name} video`}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <video src={images[imageIndexInRange]} className="w-full h-full object-cover" controls playsInline preload="metadata" />
            )
          ) : (
                <button
                  type="button"
                  onClick={() => setViewerOpen(true)}
                  aria-label={`View ${product.name} image ${imageIndexInRange + 1} full screen`}
                  className="absolute inset-0 z-0 h-full w-full cursor-zoom-in p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <ImageWithFallback
                    src={images[imageIndexInRange]}
                    fallbackSrc={fallbackImage}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
          )}
          {images.length > 1 && (
            <>
                  <button
                    type="button"
                    onClick={prevImage}
                    aria-label="View previous product image"
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 p-1.5 bg-background/80 backdrop-blur rounded-full text-foreground hover:bg-background/95 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    aria-label="View next product image"
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-1.5 bg-background/80 backdrop-blur rounded-full text-foreground hover:bg-background/95 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* Dots */}
                  <div className="absolute bottom-2 inset-x-0 z-10 flex justify-center gap-1">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setImageIndex(i)}
                        aria-label={`View product media ${i + 1}`}
                          aria-current={i === imageIndexInRange ? "true" : undefined}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-colors",
                          i === imageIndex ? "bg-white" : "bg-white/40"
                        )}
                      />
                    ))}
                  </div>
            </>
          )}

          {/* Discount badge */}
          {discount > 0 && (
            <div className="absolute top-3 left-3 z-10">
              <Badge className="bg-rose-500 text-white text-[10px] px-1.5 h-5 border-0">
                -{discount}%
              </Badge>
            </div>
          )}
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            aria-label="View product media full screen"
            title="View full media"
            className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
          {/* Product name + shop */}
          <div>
            <h2 className="text-lg font-bold leading-tight">{product.name}</h2>
            {shopName && (
              <p className="text-xs text-muted-foreground mt-0.5">by {shopName}</p>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-brand">K{product.price.toLocaleString()}</span>
            {product.originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                K{product.originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* Rating + reviews + stock */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              <span className="font-medium">{product.rating}</span>
              <span>({product.reviews} reviews)</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              <span>{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{product.views} views</span>
            </div>
          </div>

          {/* Category + tags */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
            {(product.tags || []).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h4 className="text-xs font-semibold mb-1">Description</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
            </div>
          )}
        </div>

        {/* Primary action — fixed at bottom */}
        <div className="p-4 border-t border-border shrink-0 space-y-2">
          <Button
            className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold"
            onClick={() => (onPrimaryAction ? onPrimaryAction(product) : onMakeDeal?.(product))}
            disabled={product.stock <= 0}
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            {product.stock > 0 ? primaryActionLabel || "Make a Deal" : "Out of Stock"}
          </Button>
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="outline"
              className="w-full h-10 text-sm"
              onClick={() => onSecondaryAction(product)}
              disabled={secondaryActionDisabled ?? product.stock <= 0}
            >
              <Store className="mr-2 h-4 w-4" />
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <ImageViewerModal
      isOpen={viewerOpen}
      onClose={() => setViewerOpen(false)}
      images={images}
      initialIndex={imageIndexInRange}
      alt={product.name}
    />
    </>
  );
}
