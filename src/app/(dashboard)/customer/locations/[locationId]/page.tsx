"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Store, Star, Search, Users, Loader2, Package, ShoppingBag, ChevronRight, Eye, ArrowLeft, Filter, TrendingUp, Sparkles, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation, useShops, useProducts, useChats, createChat, sendMessage, type ProductData, type LocationData } from "@/hooks/useApi";
import { useAuthStore } from "@/store/authStore";
import { useDealStore } from "@/store/dealStore";
import { useOnlineStore } from "@/store/onlineStore";
import VerifiedBadge from "@/components/VerifiedBadge";
import ProductDetailModal from "@/components/ProductDetailModal";
import DealModal from "@/components/DealModal";
import DealSuccessPopup from "@/components/DealSuccessPopup";
import ImageViewerModal from "@/components/ImageViewerModal";
import ProductPreviewStrip from "@/components/ProductPreview";
import ImageWithFallback from "@/components/ImageWithFallback";
import { DEFAULT_SHOP_COVER, productPlaceholder } from "@/lib/placeholders";

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "mkv"];
function isVideoUrl(url: string): boolean {
  try {
    const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase();
    if (ext && VIDEO_EXTENSIONS.includes(ext)) return true;
    if (url.includes("/video/upload/")) return true;
    return false;
  } catch { return false; }
}

type ProductFilter = "all" | "promo" | "new" | string;

export default function LocationDetailPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const searchParams = useSearchParams();
  const initialShopId = searchParams.get("shopId");
  const initialProductId = searchParams.get("productId");
  const openedInitialProduct = useRef(false);
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedShop, setSelectedShop] = useState<string | null>(initialShopId);

  // Push history entry when selecting a shop so back returns to shops list
  const selectShop = (shopId: string | null) => {
    if (shopId) {
      setSelectedShop(shopId);
      window.history.pushState({ shopId }, "", `?shopId=${shopId}`);
    } else {
      setSelectedShop(null);
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  // Handle native back button
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const shopId = params.get("shopId");
      if (shopId) {
        setSelectedShop(shopId);
      } else {
        setSelectedShop(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [dealProduct, setDealProduct] = useState<ProductData | null>(null);
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealSending, setDealSending] = useState(false);
  const [dealSuccess, setDealSuccess] = useState<{ productName: string; quantity: number; totalPrice: number; chatId: string } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [productSearch, setProductSearch] = useState("");

  const openViewer = (images: string[], index: number) => { setViewerImages(images); setViewerIndex(index); setViewerOpen(true); };
  const dealCount = useDealStore((s) => s.dealCount);
  const incrementDealCount = useDealStore((s) => s.incrementDealCount);
  const onlineUserIds = useOnlineStore((s) => s.onlineUserIds);

  const { data: locData, loading: locLoading } = useLocation(locationId);
  const { data: shopsData, loading: shopsLoading } = useShops({ locationId: locationId || undefined });
  const { data: productsData, loading: productsLoading } = useProducts(selectedShop ? { shopId: selectedShop } : undefined);

  const location = locData?.location;
  const allShops = shopsData?.shops || [];

  // Auto-select shop from URL param once shops are loaded
  useEffect(() => {
    if (initialShopId && !selectedShop && allShops.length > 0) {
      const match = allShops.find((s) => s.id === initialShopId);
      if (match) setSelectedShop(initialShopId);
    }
  }, [initialShopId, allShops, selectedShop]);

  // Deep link from a product preview: open the shop and the exact product.
  useEffect(() => {
    if (!initialProductId || openedInitialProduct.current || allShops.length === 0) return;
    for (const shop of allShops) {
      const product = (shop.previewProducts || []).find((p) => p.id === initialProductId);
      if (!product) continue;
      openedInitialProduct.current = true;
      setSelectedShop(shop.id);
      window.history.replaceState(
        { shopId: shop.id, productId: product.id },
        "",
        `?shopId=${shop.id}&productId=${product.id}`
      );
      setSelectedProduct(product);
      return;
    }
  }, [initialProductId, allShops]);

  // Track shop view
  useEffect(() => {
    if (selectedShop) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "shop_view", targetId: selectedShop }),
      }).catch(() => {});
    }
  }, [selectedShop]);

  // All specialties from shops in this location
  const allSpecialties = Array.from(new Set(allShops.flatMap((s) => s.specialties || [])));
  const categories = ["all", ...allSpecialties];

  // Filtered shops
  const filtered = allShops.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === "all" || s.specialties?.includes(selectedCategory);
    return matchSearch && matchCat;
  });

  const shopProducts = productsData?.products || [];
  const currentShop = allShops.find((s) => s.id === selectedShop);

  // Filter products based on productFilter
  const filteredProducts = shopProducts.filter((p) => {
    if (productFilter === "promo") return p.discount && p.discount > 0;
    if (productFilter === "new") {
      const age = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return age <= 14; // products added in last 14 days
    }
    if (productFilter !== "all" && productFilter !== "promo" && productFilter !== "new") {
      return p.category === productFilter;
    }
    return true;
  }).filter((p) => {
    if (!productSearch) return true;
    return p.name.toLowerCase().includes(productSearch.toLowerCase());
  }).sort((a, b) => {
    if (productFilter === "new") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0; // default order (API returns ranked)
  });

  // Product categories for filter tabs
  const productCategories = Array.from(new Set(shopProducts.map((p) => p.category).filter(Boolean)));

  const handleProductClick = (product: ProductData) => { setSelectedProduct(product); };

  // Open a product previewed on the location header (shop derived from product).
  const handleLocationPreview = (product: ProductData) => {
    const shopId = typeof product.shopId === "string" ? product.shopId : product.shopId?.id;
    if (!shopId) return;
    setSelectedShop(shopId);
    window.history.pushState(
      { shopId, productId: product.id },
      "",
      `?shopId=${shopId}&productId=${product.id}`
    );
    setSelectedProduct(product);
  };

  const handleMakeDealFromProduct = (product: ProductData) => {
    setSelectedProduct(null);
    setDealProduct(product);
    setShowDealModal(true);
  };

  const handleDealSend = useCallback(async (data: { quantity: number; suggestedPrice: number; message: string }) => {
    if (!dealProduct || !user || !currentShop) return;
    setDealSending(true);
    try {
      const ownerId = typeof currentShop.ownerId === "string" ? currentShop.ownerId : (currentShop.ownerId as { id: string }).id;
      const createRes = await createChat({
        type: "deal",
        participants: [user.id, ownerId],
        dealInfo: { productName: dealProduct.name, productId: dealProduct.id, quantity: data.quantity, initialPrice: data.suggestedPrice, status: "pending" },
      });
      const chatId = createRes.chat.id;
      const senderName = `${user.firstName} ${user.lastName}`;
      await sendMessage({ chatId, senderId: user.id, senderName, senderRole: "customer", content: data.message, type: "text" });
      setShowDealModal(false);
      incrementDealCount();
      setDealSuccess({ productName: dealProduct.name, quantity: data.quantity, totalPrice: data.quantity * data.suggestedPrice, chatId });
      setDealProduct(null);
    } catch (e) { console.error("Failed to create deal:", e); } finally { setDealSending(false); }
  }, [dealProduct, user, currentShop, incrementDealCount]);

  const loading = selectedShop ? false : (locLoading || shopsLoading);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => selectedShop ? selectShop(null) : router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-bold truncate">{selectedShop ? currentShop?.name || "Shop" : location?.name || "Location"}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 max-w-5xl mx-auto">
        {loading ? (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4 sm:p-5 space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-2 w-full" /><Skeleton className="h-2 w-3/4" />
              <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded" /><Skeleton className="h-5 w-16 rounded" /><Skeleton className="h-5 w-16 rounded" /></div>
              <div className="flex gap-4"><Skeleton className="h-2 w-16" /><Skeleton className="h-2 w-16" /><Skeleton className="h-2 w-16" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-4" /></div>
                  <Skeleton className="h-2 w-full" /><Skeleton className="h-2 w-3/4" />
                  <div className="flex gap-1"><Skeleton className="h-4 w-14 rounded" /><Skeleton className="h-4 w-14 rounded" /></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Location Header — no time, no contact */}
            {location && !selectedShop && (
              <Card className="bg-card border-border overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-brand via-brand to-primary" />
                <CardContent className="p-4 sm:p-5">
                  <h1 className="text-xl font-bold mb-2">{location.name}</h1>
                  <p className="text-sm text-muted-foreground mb-3">{location.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(location.specialties || []).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />{location.rating || "—"}</div>
                    <div className="flex items-center gap-1"><Store className="h-3 w-3" />{allShops.length} shops</div>
                    <div className="flex items-center gap-1"><Package className="h-3 w-3" />{location.productCount ?? 0} products</div>
                    <div className="flex items-center gap-1"><Eye className="h-3 w-3" />{(location as LocationData & { totalViews?: number }).totalViews ? `${(location as LocationData & { totalViews?: number }).totalViews} views` : "New"}</div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />{onlineUserIds.size} active</div>
                  </div>

                  {(location.previewProducts?.length || 0) > 0 && (
                    <div className="mt-4 border-t border-brand/10 pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-brand">
                        Popular products here
                      </p>
                      <ProductPreviewStrip
                        products={location.previewProducts || []}
                        max={9}
                        showPrice
                        onSelect={handleLocationPreview}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Shop Products with Filters */}
            {selectedShop && (
              <div className="space-y-3">
                {/* Shop header */}
                {currentShop && (
                  <div className="flex items-center gap-3 p-3 bg-brand-soft/60 border border-brand/10 rounded-lg">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={currentShop.profileImage} alt={currentShop.name} />
                      <AvatarFallback className="bg-primary/10 text-brand text-sm">
                        {currentShop.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-sm truncate">{currentShop.name}</h3>
                        {currentShop.status === "verified" && <VerifiedBadge size="sm" />}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {currentShop.rating ? <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />{currentShop.rating}</span> : null}
                        <span>{currentShop.productCount || 0} products</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] shrink-0" onClick={() => {
                      const profilePath = `/customer/profile/${typeof currentShop.ownerId === "string" ? currentShop.ownerId : (currentShop.ownerId as { id: string }).id}`;
                      router.push(profilePath);
                    }}>View Profile</Button>
                  </div>
                )}

                {/* Product filters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {[
                    { key: "all", label: "All", icon: Package },
                    { key: "promo", label: "Promo", icon: Tag },
                    { key: "new", label: "New", icon: Sparkles },
                    ...productCategories.map((c) => ({ key: c, label: c, icon: TrendingUp })),
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setProductFilter(key as ProductFilter)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                        productFilter === key
                          ? "bg-primary text-primary-foreground"
                          : "bg-brand-soft text-brand hover:bg-brand-muted/60"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Product search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-10 h-9 text-sm" />
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-brand" />
                    Products ({productsLoading ? "..." : filteredProducts.length})
                  </h3>
                </div>

                {productsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="bg-card border border-border rounded-lg p-3 space-y-2">
                        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                        <Skeleton className="h-3 w-3/4" />
                        <div className="flex justify-between"><Skeleton className="h-3 w-16" /><Skeleton className="h-2 w-12" /></div>
                      </div>
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-muted-foreground">No products found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredProducts.map((product) => (
                      <Card key={product.id} className="bg-card border-border hover:border-primary/30 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                        onClick={() => handleProductClick(product)}>
                        <CardContent className="p-3">
                          <div className="mb-2 relative">
                            {product.images && product.images.length > 0 ? (
                              product.images.length === 1 ? (
                                <div className="aspect-[4/3] w-full bg-muted rounded-lg overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); openViewer(product.images!, 0); }}>
                                  {isVideoUrl(product.images[0]) ? (
                                    <video src={product.images[0]} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="metadata" />
                                  ) : (
                                    <ImageWithFallback src={product.images[0]} fallbackSrc={productPlaceholder(product.category, product.id)} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                                  )}
                                </div>
                              ) : (
                                <div className="aspect-[4/3] grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden">
                                  {product.images.slice(0, 2).map((img, i) => (
                                    <div key={i} className="relative h-full w-full min-w-0 overflow-hidden bg-muted cursor-pointer" onClick={(e) => { e.stopPropagation(); openViewer(product.images!, i); }}>
                                      {isVideoUrl(img) ? (
                                        <video src={img} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="metadata" />
                                      ) : (
                                        <ImageWithFallback src={img} fallbackSrc={productPlaceholder(product.category, `${product.id}-${i}`)} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                                      )}
                                      {i === 1 && product.images!.length > 2 && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                          <span className="text-white text-lg font-bold">+{product.images!.length - 2}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )
                            ) : (
                              <div className="aspect-[4/3] w-full bg-muted rounded-lg overflow-hidden">
                                <ImageWithFallback src={undefined} fallbackSrc={productPlaceholder(product.category, product.id)} alt={product.name} className="w-full h-full object-cover" />
                              </div>
                            )}
                            {product.discount && product.discount > 0 && (
                              <div className="absolute top-1 right-1 z-10 pointer-events-none">
                                <Badge className="bg-rose-500 text-white text-[9px] px-1 h-4 border-0">-{product.discount}%</Badge>
                              </div>
                            )}
                          </div>
                          <h4 className="font-medium text-xs truncate mb-0.5">{product.name}</h4>
                          <p className="text-[10px] text-muted-foreground truncate mb-1.5">{product.description}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-brand">K{product.price.toLocaleString()}</span>
                            {product.originalPrice && (
                              <span className="text-[10px] text-muted-foreground line-through">K{product.originalPrice.toLocaleString()}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                              <span className="text-[10px]">{product.rating} ({product.reviews})</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{product.stock} in stock</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search + Category Filter for shops */}
            {!selectedShop && (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input placeholder="Search shops..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
                    ))}
                  </select>
                </div>

                {/* Shops Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((shop) => (
                    <Card key={shop.id} className="bg-card border-border hover:border-brand/30 transition-colors cursor-pointer overflow-hidden"
                      onClick={() => selectShop(shop.id)}>
                      {shop.coverImage && (
                        <div className="h-20 w-full overflow-hidden">
                           <ImageWithFallback src={shop.coverImage} fallbackSrc={DEFAULT_SHOP_COVER} alt={`${shop.name} cover`} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="h-12 w-12 shrink-0">
                            <AvatarImage src={shop.profileImage} alt={shop.name} />
                            <AvatarFallback className="bg-primary/10 text-brand text-sm">
                              {shop.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold text-sm truncate">{shop.name}</h3>
                              {shop.status === "verified" && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              {shop.rating ? (
                                <span className="flex items-center gap-0.5">
                                  <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                                  {shop.rating} ({shop.totalReviews})
                                </span>
                              ) : <span>No ratings</span>}
                              {shop.totalViews ? <span>{shop.totalViews} views</span> : null}
                              <span>{shop.productCount || 0} products</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{shop.description}</p>

                        <ProductPreviewStrip
                          products={shop.previewProducts || []}
                          max={3}
                          showPrice
                          className="mb-3"
                          onSelect={(product) => {
                            setSelectedShop(shop.id);
                            window.history.pushState(
                              { shopId: shop.id, productId: product.id },
                              "",
                              `?shopId=${shop.id}&productId=${product.id}`
                            );
                            setSelectedProduct(product);
                          }}
                        />

                        <div className="flex flex-wrap gap-1 mb-3">
                          {(shop.specialties || []).slice(0, 3).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] border-brand/20 text-brand">{s}</Badge>
                          ))}
                        </div>
                        <Button size="sm" variant="outline" className="w-full h-7 text-[11px] border-brand/30 text-brand hover:bg-brand-soft"
                          onClick={(e) => { e.stopPropagation(); selectShop(shop.id); }}>
                          <Package className="h-3 w-3 mr-1" />Browse Products
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filtered.length === 0 && (
                  <div className="text-center py-12">
                    <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No shops found</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {selectedProduct && (
        <ProductDetailModal isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} product={selectedProduct} shopName={currentShop?.name} onMakeDeal={handleMakeDealFromProduct} />
      )}
      <DealModal isOpen={showDealModal} onClose={() => { setShowDealModal(false); setDealProduct(null); }} productName={dealProduct?.name || ""} productPrice={dealProduct?.price} shopName={currentShop?.name} onSendDeal={handleDealSend} sending={dealSending} />
      <DealSuccessPopup isOpen={!!dealSuccess} onClose={() => setDealSuccess(null)} productName={dealSuccess?.productName || ""} quantity={dealSuccess?.quantity || 0} totalPrice={dealSuccess?.totalPrice || 0}
        onGoToChat={() => { if (dealSuccess?.chatId) router.push(`/customer/chat?chatId=${dealSuccess.chatId}`); setDealSuccess(null); }}
        onContinueBrowsing={() => setDealSuccess(null)} />
      <ImageViewerModal isOpen={viewerOpen} onClose={() => setViewerOpen(false)} images={viewerImages} initialIndex={viewerIndex} alt="Product image" />
    </div>
  );
}
