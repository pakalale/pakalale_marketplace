"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChevronRight, Flame, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ImageWithFallback from "@/components/ImageWithFallback";
import ProductPreviewStrip from "@/components/ProductPreview";
import VerifiedBadge from "@/components/VerifiedBadge";
import { shopImagePlaceholder } from "@/lib/placeholders";
import type { ProductData, ShopData } from "@/hooks/useApi";

interface TrendingShopsSectionProps {
  shops: ShopData[];
  loading: boolean;
  onAddToCart: (product: ProductData) => void;
  onOpenShop: (shop: ShopData) => void;
  onOpenProduct: (shop: ShopData, product: ProductData) => void;
  onSeeAll: () => void;
}

export default function TrendingShopsSection({
  shops,
  loading,
  onAddToCart,
  onOpenShop,
  onOpenProduct,
  onSeeAll,
}: TrendingShopsSectionProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const lastInteractionRef = useRef(0);
  const activeSlideIndexRef = useRef(0);
  const resetTimerRef = useRef<number | undefined>(undefined);
  const shopsWithProductPhotos = shops.filter((shop) => (shop.previewProducts?.length || 0) > 0);
  const shopCount = shopsWithProductPhotos.length;
  const carouselShops = shopCount > 1
    ? [...shopsWithProductPhotos, shopsWithProductPhotos[0]]
    : shopsWithProductPhotos;
  const allocatedImages = new Set<string>();
  const shopImages = new Map(shopsWithProductPhotos.map((shop, index) => {
    const coverFallback = shopImagePlaceholder(`${shop.id}-${index}-cover`, "cover", [...allocatedImages]);
    const coverImage = shop.coverImage && !allocatedImages.has(shop.coverImage)
      ? shop.coverImage
      : coverFallback;
    allocatedImages.add(coverImage);

    const profileFallback = shopImagePlaceholder(`${shop.id}-${index}-profile`, "profile", [...allocatedImages]);
    const profileImage = shop.profileImage && !allocatedImages.has(shop.profileImage)
      ? shop.profileImage
      : profileFallback;
    allocatedImages.add(profileImage);

    return [shop.id, { coverImage, coverFallback, profileImage, profileFallback }] as const;
  }));

  const getSlideWidth = (carousel: HTMLDivElement) => {
    const firstSlide = carousel.firstElementChild as HTMLElement | null;
    if (!firstSlide) return 0;
    const gap = Number.parseFloat(window.getComputedStyle(carousel).columnGap) || 0;
    return firstSlide.getBoundingClientRect().width + gap;
  };

  const scrollToSlide = useCallback((index: number) => {
    const carousel = carouselRef.current;
    if (!carousel || shopCount < 2) return;
    const slideWidth = getSlideWidth(carousel);
    if (!slideWidth) return;

    if (index >= shopCount) {
      carousel.scrollTo({ left: slideWidth * shopCount, behavior: "smooth" });
      activeSlideIndexRef.current = 0;
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => {
        carousel.scrollLeft = 0;
      }, 700);
      return;
    }

    carousel.scrollTo({ left: slideWidth * index, behavior: "smooth" });
    activeSlideIndexRef.current = index;
  }, [shopCount]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || shopCount < 2 || typeof IntersectionObserver === "undefined") return;

    let timer: number | undefined;
    let isVisible = false;

    const advance = () => {
      const pauseRemaining = 8000 - (performance.now() - lastInteractionRef.current);
      if (pauseRemaining > 0) {
        timer = window.setTimeout(advance, pauseRemaining);
        return;
      }
      scrollToSlide(activeSlideIndexRef.current + 1);
      scheduleNext();
    };

    const scheduleNext = () => {
      window.clearTimeout(timer);
      if (isVisible) timer = window.setTimeout(advance, 6000);
    };

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) scheduleNext();
      else window.clearTimeout(timer);
    });

    observer.observe(carousel);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      window.clearTimeout(resetTimerRef.current);
    };
  }, [scrollToSlide, shopCount]);

  const noteInteraction = () => {
    lastInteractionRef.current = performance.now();
  };

  const syncSlideIndex = () => {
    const carousel = carouselRef.current;
    if (!carousel || shopsWithProductPhotos.length < 2) return;
    const slideWidth = getSlideWidth(carousel);
    if (!slideWidth) return;
    const index = Math.round(carousel.scrollLeft / slideWidth);
    activeSlideIndexRef.current = index >= shopsWithProductPhotos.length ? 0 : index;
  };

  return (
    <section aria-label="Trending shops">
      <div className="mb-1.5 flex h-10 items-center justify-between gap-2 overflow-hidden rounded-md border-l-[3px] border-cyan-300 bg-[#002583] px-2.5 text-white sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Flame className="h-4 w-4 shrink-0 text-cyan-200" />
          <h2 className="truncate text-xs font-bold">Trending Shops</h2>
          <span className="hidden rounded-full bg-cyan-300 px-1.5 py-0.5 text-[8px] font-extrabold uppercase leading-none text-[#002583] min-[380px]:inline">Trending now</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shopsWithProductPhotos.length > 1 && (
            <button
              type="button"
              onClick={() => {
                noteInteraction();
                scrollToSlide(activeSlideIndexRef.current + 1);
              }}
              aria-label="Next trending shop"
              className="flex h-7 w-7 items-center justify-center rounded-full text-cyan-100 transition-colors hover:bg-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onSeeAll}
            className="flex items-center gap-0.5 text-[10px] font-semibold text-cyan-100 hover:underline"
          >
            See all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="w-full overflow-hidden rounded-lg border border-border bg-card sm:w-[320px] sm:min-w-[300px]">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2 p-2">
            <div className="flex items-center gap-2"><Skeleton className="h-7 w-7 rounded-lg" /><Skeleton className="h-3 w-28" /></div>
            <Skeleton className="h-3 w-24" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((item) => (
                <div key={item} className="space-y-2 rounded-2xl border border-border p-3">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-7 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : shopsWithProductPhotos.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          No trending shops have product photos yet.
        </p>
      ) : (
        <div
          ref={carouselRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-hide"
          onPointerDown={noteInteraction}
          onPointerMove={(event) => { if (event.buttons > 0) noteInteraction(); }}
          onTouchStart={noteInteraction}
          onTouchMove={noteInteraction}
          onWheel={noteInteraction}
          onKeyDown={noteInteraction}
          onScroll={syncSlideIndex}
          tabIndex={0}
          aria-label="Trending shops"
        >
          {carouselShops.map((shop, index) => {
            const images = shopImages.get(shop.id)!;
            return (
              <Card
                key={`${shop.id}-${index}`}
                aria-hidden={index >= shopsWithProductPhotos.length ? true : undefined}
                inert={index >= shopsWithProductPhotos.length}
                className="w-full min-w-full max-w-none shrink-0 snap-start border-border bg-card transition-colors hover:border-primary/30 sm:w-[320px] sm:min-w-[300px] sm:max-w-[320px]"
                onClick={() => {
                  if (index < shopsWithProductPhotos.length) onOpenShop(shop);
                }}
              >
                <CardContent className="p-0">
                  <div className="h-16 w-full overflow-hidden bg-muted">
                    <ImageWithFallback src={images.coverImage} fallbackSrc={images.coverFallback} alt={`${shop.name} cover`} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-2">
                    <div className="mb-1 flex items-center gap-2">
                      <ImageWithFallback src={images.profileImage} fallbackSrc={images.profileFallback} alt={shop.name} className="h-7 w-7 shrink-0 rounded-md bg-muted object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h3 className="truncate text-xs font-medium">{shop.name}</h3>
                          {shop.status === "verified" && <VerifiedBadge size="sm" />}
                        </div>
                      </div>
                    </div>
                    <div className="mb-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{shop.locationId || "Lusaka"}</span>
                      <span className="shrink-0 text-brand">· {shop.productCount ?? 0} products</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-[10px] font-medium">{shop.rating || "—"}</span>
                      </div>
                      <Badge variant="secondary" className="h-4 bg-brand-soft px-1 text-[9px] text-brand">
                        {shop.specialties?.[0] || ""}
                      </Badge>
                    </div>
                    <ProductPreviewStrip
                      products={shop.previewProducts || []}
                      max={4}
                      layout="carousel"
                      compact
                      className="mt-1"
                      onAddToCart={onAddToCart}
                      onSelect={(product) => {
                        if (index < shopsWithProductPhotos.length) onOpenProduct(shop, product);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}