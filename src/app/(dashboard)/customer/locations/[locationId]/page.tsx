"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Store, Star, Search, Package, Eye, TrendingUp, Sparkles, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation, useShops, useProducts, useShopPosts, type FeedPostData, type ProductData, type LocationData } from "@/hooks/useApi";
import { useCartStore } from "@/store/cartStore";
import { cartLineFromProduct } from "@/lib/cart";
import ProductCard from "@/components/landing/ProductCard";
import toast from "react-hot-toast";
import { useOnlineStore } from "@/store/onlineStore";
import VerifiedBadge from "@/components/VerifiedBadge";
import ProductDetailModal from "@/components/ProductDetailModal";
import ProductPreviewStrip from "@/components/ProductPreview";
import ImageWithFallback from "@/components/ImageWithFallback";
import { DEFAULT_SHOP_COVER } from "@/lib/placeholders";

type ProductFilter = "all" | "promo" | "new" | string;

export default function LocationDetailPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const searchParams = useSearchParams();
  const initialShopId = searchParams.get("shopId");
  const initialProductId = searchParams.get("productId");
  const initialCategory = searchParams.get("category");
  const openedInitialProduct = useRef(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedShop, setSelectedShop] = useState<string | null>(initialShopId);

  // Keep the location list in history so native Back returns to it.
  const selectShop = (shopId: string) => {
    setSelectedShop(shopId);
    window.history.pushState({ shopId }, "", `?shopId=${shopId}`);
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
  const [productFilter, setProductFilter] = useState<ProductFilter>(initialCategory || "all");
  const [productSearch, setProductSearch] = useState("");
  const addItem = useCartStore((state) => state.addItem);
  const onlineUserIds = useOnlineStore((s) => s.onlineUserIds);

  const { data: locData, loading: locLoading } = useLocation(locationId);
  const { data: shopsData, loading: shopsLoading } = useShops({ locationId: locationId || undefined });
  const { data: productsData, loading: productsLoading } = useProducts(selectedShop ? { shopId: selectedShop } : undefined);

  const location = locData?.location;
  const allShops = shopsData?.shops || [];
  const currentShop = allShops.find((s) => s.id === selectedShop);
  const currentShopOwnerId = currentShop
    ? typeof currentShop.ownerId === "string" ? currentShop.ownerId : currentShop.ownerId.id
    : null;
  const { data: shopPostsData } = useShopPosts(currentShopOwnerId);

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
  const promotionPostsByProduct = new Map<string, FeedPostData>();
  const arrivalPostsByProduct = new Map<string, FeedPostData>();
  const findPostProductId = (post: FeedPostData) => {
    const productId = post.product?.id;
    if (productId && shopProducts.some((product) => product.id === productId)) return productId;
    return shopProducts.find((product) => product.name.trim().toLowerCase() === post.product?.name.trim().toLowerCase())?.id;
  };

  (shopPostsData?.posts || []).forEach((post) => {
    const productId = findPostProductId(post);
    if (!productId) return;

    const target = post.isPromotion || post.postType === "promotion" || post.postType === "price_drop"
      ? promotionPostsByProduct
      : post.postType === "product_arrival" ? arrivalPostsByProduct : null;
    if (!target) return;

    const existing = target.get(productId);
    if (!existing || new Date(post.createdAt) > new Date(existing.createdAt)) {
      target.set(productId, post);
    }
  });

  const shopProductsWithPosts = shopProducts.map((product) => {
    const promotion = promotionPostsByProduct.get(product.id)?.product;
    if (!promotion || promotion.price <= 0) return product;

    const originalPrice = promotion.originalPrice ?? product.price;
    if (originalPrice <= promotion.price) return product;

    return {
      ...product,
      price: promotion.price,
      originalPrice,
      discount: promotion.discount ?? Math.round(((originalPrice - promotion.price) / originalPrice) * 100),
    };
  });

  // Filter products based on productFilter
  const filteredProducts = shopProductsWithPosts.filter((p) => {
    if (productFilter === "promo") return (p.discount || 0) > 0 || promotionPostsByProduct.has(p.id);
    if (productFilter === "new") {
      const arrivalPost = arrivalPostsByProduct.get(p.id);
      const productAge = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const postAge = arrivalPost ? (Date.now() - new Date(arrivalPost.createdAt).getTime()) / (1000 * 60 * 60 * 24) : Infinity;
      return productAge <= 14 || postAge <= 14;
    }
    if (productFilter !== "all" && productFilter !== "promo" && productFilter !== "new") {
      return p.category === productFilter;
    }
    return true;
  }).filter((p) => {
    if (!productSearch) return true;
    return p.name.toLowerCase().includes(productSearch.toLowerCase());
  }).sort((a, b) => {
    if (productFilter === "new") {
      const aDate = Math.max(new Date(a.createdAt).getTime(), new Date(arrivalPostsByProduct.get(a.id)?.createdAt || 0).getTime());
      const bDate = Math.max(new Date(b.createdAt).getTime(), new Date(arrivalPostsByProduct.get(b.id)?.createdAt || 0).getTime());
      return bDate - aDate;
    }
    if (productFilter === "promo") {
      const aDate = new Date(promotionPostsByProduct.get(a.id)?.createdAt || a.updatedAt).getTime();
      const bDate = new Date(promotionPostsByProduct.get(b.id)?.createdAt || b.updatedAt).getTime();
      return bDate - aDate;
    }
    return 0; // default order (API returns ranked)
  });

  // Product categories for filter tabs
  const productCategories = Array.from(new Set(shopProducts.map((p) => p.category).filter(Boolean)));

  const handleProductClick = (product: ProductData) => { setSelectedProduct(product); };

  const handleAddToCart = (product: ProductData) => {
    const line = cartLineFromProduct(product);
    if (!line) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem(line);
    toast.success(`${product.name} added to cart`);
  };

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

  const openProductShop = (product: ProductData) => {
    setSelectedProduct(null);
    setProductSearch("");
    setProductFilter(product.category || "all");
    if (currentShop) {
      window.history.replaceState(
        { shopId: currentShop.id },
        "",
        `?shopId=${currentShop.id}&category=${encodeURIComponent(product.category || "all")}`
      );
    }
  };

  const loading = selectedShop ? false : (locLoading || shopsLoading);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4">
          <div aria-hidden="true" />
          <h1 className="max-w-[70vw] truncate text-sm font-bold">{selectedShop ? currentShop?.name || "Shop" : location?.name || "Location"}</h1>
          <div aria-hidden="true" />
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
                        onAddToCart={handleAddToCart}
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
                  <div className="space-y-2">
                    <div className="h-28 overflow-hidden rounded-lg border border-border bg-muted sm:h-40">
                      <ImageWithFallback
                        src={currentShop.coverImage}
                        fallbackSrc={DEFAULT_SHOP_COVER}
                        alt={`${currentShop.name} cover`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-brand/10 bg-brand-soft/60 p-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={currentShop.profileImage} alt={currentShop.name} />
                        <AvatarFallback className="bg-primary/10 text-brand text-sm">
                          {currentShop.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-semibold text-sm truncate">{currentShop.name}</h3>
                          {currentShop.status === "verified" ? (
                            <VerifiedBadge size="sm" />
                          ) : (
                            <Badge
                              variant="outline"
                              className={currentShop.status === "rejected" ? "border-destructive/30 text-destructive" : "border-amber-500/30 text-amber-600"}
                            >
                              {currentShop.status === "rejected" ? "Verification rejected" : "Verification pending"}
                            </Badge>
                          )}
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                        <Skeleton className="aspect-square w-full rounded-xl" />
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-10 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-muted-foreground">No products found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpen={handleProductClick}
                        onAddToCart={handleAddToCart}
                      />
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
                          className="mb-3"
                          onAddToCart={handleAddToCart}
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
        <ProductDetailModal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          shopName={currentShop?.name}
          primaryActionLabel="Add to Cart"
          onPrimaryAction={(product) => {
            handleAddToCart(product);
            setSelectedProduct(null);
          }}
          secondaryActionLabel="View Shop"
          secondaryActionDisabled={false}
          onSecondaryAction={openProductShop}
        />
      )}
    </div>
  );
}
