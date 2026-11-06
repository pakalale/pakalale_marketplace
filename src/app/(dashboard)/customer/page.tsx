"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, MapPin, Store, Star, Loader2, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import Feed from "@/components/Feed";
import { useAuthStore } from "@/store/authStore";
import { useShops, useLocations } from "@/hooks/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import VerifiedBadge from "@/components/VerifiedBadge";
import ProductPreviewStrip from "@/components/ProductPreview";
import ImageWithFallback from "@/components/ImageWithFallback";
import { shopImagePlaceholder } from "@/lib/placeholders";

export default function CustomerDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("home");
  const [showWelcome, setShowWelcome] = useState(false);
  const trendingCarouselRef = useRef<HTMLDivElement>(null);
  const lastCarouselInteractionRef = useRef(0);
  const { data: shopsData, loading: shopsLoading } = useShops();
  const { data: locationsData } = useLocations();

  const trendingShops = shopsData?.shops || [];
  const carouselShops = trendingShops.length > 1
    ? [...trendingShops, ...trendingShops]
    : trendingShops;
  const allocatedShopImages = new Set<string>();
  const shopImages = new Map(trendingShops.map((shop, index) => {
    const coverFallback = shopImagePlaceholder(`${shop.id}-${index}-cover`, "cover", [...allocatedShopImages]);
    const coverImage = shop.coverImage && !allocatedShopImages.has(shop.coverImage)
      ? shop.coverImage
      : coverFallback;
    allocatedShopImages.add(coverImage);

    const profileFallback = shopImagePlaceholder(`${shop.id}-${index}-profile`, "profile", [...allocatedShopImages]);
    const profileImage = shop.profileImage && !allocatedShopImages.has(shop.profileImage)
      ? shop.profileImage
      : profileFallback;
    allocatedShopImages.add(profileImage);

    return [shop.id, { coverImage, coverFallback, profileImage, profileFallback }] as const;
  }));
  const carouselCards = carouselShops.map((shop, index) => ({
    shop,
    index,
    ...shopImages.get(shop.id)!,
  }));
  const allLocations = locationsData?.locations || [];

  useEffect(() => {
    const carousel = trendingCarouselRef.current;
    if (!carousel || trendingShops.length < 2) return;

    let frame = 0;
    let previousTime = 0;
    let accumulatedScroll = 0;
    const animate = (time: number) => {
      if (!previousTime) previousTime = time;
      const elapsed = Math.min(time - previousTime, 40);
      previousTime = time;

      if (time - lastCarouselInteractionRef.current > 1200) {
        accumulatedScroll += elapsed * 0.02;
        const wholePixels = Math.floor(accumulatedScroll);
        if (wholePixels > 0) {
          carousel.scrollLeft += wholePixels;
          accumulatedScroll -= wholePixels;
        }
        if (carousel.scrollLeft >= carousel.scrollWidth / 2) carousel.scrollLeft = 0;
      } else {
        accumulatedScroll = 0;
      }
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [trendingShops.length]);

  const noteCarouselInteraction = () => {
    lastCarouselInteractionRef.current = performance.now();
  };

  // Show welcome only once per login session
  useEffect(() => {
    const hasSeenWelcome = sessionStorage.getItem("pakalale_welcome_seen");
    if (!hasSeenWelcome) {
      setShowWelcome(true);
      sessionStorage.setItem("pakalale_welcome_seen", "1");
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header activeTab={activeTab} onTabChange={setActiveTab} userId={user?.id} />
      <main className="p-3 sm:p-4 space-y-4 max-w-2xl mx-auto">

        {/* ── Welcome Section (animated in, fades out) ── */}
        {showWelcome && (
          <div className="text-center py-4 animate-fade-in">
            <h2 className="text-lg font-bold animate-slide-up">
              Hey, {user?.firstName} 👋
            </h2>
            <p className="text-xs text-muted-foreground mt-1 animate-slide-up" style={{ animationDelay: "0.15s" }}>
              Discover deals from shops near you
            </p>
          </div>
        )}

        {/* ── Trending Shops (infinite auto-scroll) ── */}
        <div>
          <div className="flex items-center justify-between mb-2.5 bg-brand text-brand-foreground rounded-lg px-3 py-2 shadow-sm">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              Trending Shops
            </h3>
            <button
              onClick={() => router.push("/customer/locations")}
              className="text-[11px] font-medium text-primary flex items-center gap-0.5 hover:underline"
            >
              See all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {shopsLoading ? (
            <div className="flex gap-3 overflow-x-hidden pb-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shrink-0 min-w-[160px] max-w-[180px] bg-card border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2"><Skeleton className="h-9 w-9 rounded-lg" /><Skeleton className="h-3 w-20" /></div>
                  <Skeleton className="h-2 w-16" />
                  <div className="flex items-center justify-between"><Skeleton className="h-2 w-10" /><Skeleton className="h-4 w-14 rounded" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={trendingCarouselRef}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
              onPointerDown={noteCarouselInteraction}
              onPointerMove={(event) => { if (event.buttons > 0) noteCarouselInteraction(); }}
              onTouchStart={noteCarouselInteraction}
              onTouchMove={noteCarouselInteraction}
              onWheel={noteCarouselInteraction}
              onKeyDown={noteCarouselInteraction}
              tabIndex={0}
              aria-label="Trending shops"
            >
              {carouselCards.map(({ shop, index, coverImage, coverFallback, profileImage, profileFallback }) => (
                <Card
                  key={`${shop.id}-${index}`}
                  aria-hidden={index >= trendingShops.length ? true : undefined}
                  inert={index >= trendingShops.length}
                  className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer shrink-0 min-w-[160px] max-w-[180px]"
                  onClick={() => {
                    if (index >= trendingShops.length) return;
                    router.push(`/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}`);
                  }}
                >
                  <CardContent className="p-0">
                    {/* Cover Image Banner */}
                    <div className="h-16 w-full overflow-hidden bg-muted">
                      <ImageWithFallback src={coverImage} fallbackSrc={coverFallback} alt={`${shop.name} cover`} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ImageWithFallback src={profileImage} fallbackSrc={profileFallback} alt={shop.name} className="h-9 w-9 rounded-lg object-cover shrink-0 bg-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h4 className="font-medium text-xs truncate">{shop.name}</h4>
                          {shop.status === "verified" && <VerifiedBadge size="sm" />}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{shop.locationId || "Lusaka"}</span>
                      <span className="shrink-0 text-brand">· {shop.productCount ?? 0} products</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-[10px] font-medium">{shop.rating || "—"}</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-brand-soft text-brand">
                        {shop.specialties?.[0] || ""}
                      </Badge>
                    </div>
                    <ProductPreviewStrip
                      products={shop.previewProducts || []}
                      max={3}
                      className="mt-2"
                      onSelect={(product) => {
                        if (index >= trendingShops.length) return;
                        router.push(
                          `/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}&productId=${product.id}`
                        );
                      }}
                    />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Quick Locations (with real shop counts) ── */}
        {allLocations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-brand" />
                Markets
              </h3>
              <button
                onClick={() => router.push("/customer/locations")}
                className="text-[11px] text-brand flex items-center gap-0.5 hover:underline"
              >
                See all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {allLocations.map((loc) => {
                const shopCount = trendingShops.filter((s) => s.locationId === loc.slug || s.locationId === loc.id).length;
                return (
                  <button
                    key={loc.id}
                    onClick={() => router.push(`/customer/locations/${loc.slug || loc.id}`)}
                    className="shrink-0 px-3 py-2 bg-brand-soft text-brand hover:bg-primary/15 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <MapPin className="h-3 w-3" />
                    {loc.name}
                    <span className="text-[9px] opacity-60">({shopCount})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Community Feed ── */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-brand" />
            Community Feed
          </h3>
          <Feed />
        </div>
      </main>
    </div>
  );
}
