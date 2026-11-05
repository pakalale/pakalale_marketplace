"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, TrendingUp, MapPin, Store, Star, ShoppingBag, Loader2,
  X, Clock, ArrowRight, MessageSquare, Package, Tag, ChevronRight,
  AlertCircle, Plus, Phone
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import ProductDetailModal from "@/components/ProductDetailModal";
import DealModal from "@/components/DealModal";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { cn } from "@/lib/utils";
import type { ProductData } from "@/hooks/useApi";

// ── Types ──
interface SearchResult {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  category: string;
  brand?: string;
  color?: string;
  stock: number;
  isAvailable: boolean;
  rating: number;
  reviews: number;
  views: number;
  tags: string[];
  shopId: string | { id: string; name: string; locationId?: string; rating?: number };
  score: number;
  createdAt: string;
}

interface ShopResult {
  id: string;
  name: string;
  description?: string;
  specialties: string[];
  rating?: number;
  totalReviews: number;
  locationId?: string;
  status: string;
}

interface LocationResult {
  id: string;
  name: string;
  slug: string;
  description?: string;
  specialties: string[];
  shopCount: number;
}

interface TrendingItem {
  query: string;
  count: number;
}

interface SearchData {
  products: SearchResult[];
  shops: ShopResult[];
  locations: LocationResult[];
  totalCount: number;
  page: number;
  totalPages: number;
  keywords: {
    query: string;
    tokens: string[];
    brands: string[];
    colors: string[];
    category: string | null;
    priceMax: number | null;
  };
}

// ── Search Results Content (wrapped in Suspense) ──
function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const query = searchParams.get("q") || "";

  const [searchInput, setSearchInput] = useState(query);
  const [results, setResults] = useState<SearchData | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [demandQuery, setDemandQuery] = useState("");
  const [demandSubmitted, setDemandSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "products" | "shops" | "locations">("all");
  const [searchHistory, setSearchHistory] = useState<{ query: string; timestamp: string }[]>([]);
  const [dealModal, setDealModal] = useState<{ open: boolean; product: SearchResult | null }>({ open: false, product: null });

  // Fetch search results
  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "20" });
      if (user?.id) params.set("userId", user.id);
      const res = await fetch(`/api/search/v2?${params}`);
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch trending searches
  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch("/api/search/trending?limit=10");
      const data = await res.json();
      setTrending(data.trending || []);
    } catch (e) {
      console.error("Failed to fetch trending:", e);
    }
  }, []);

  // Fetch search history
  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/search/history?userId=${user.id}&limit=10`);
      const data = await res.json();
      setSearchHistory(data.history || []);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    fetchTrending();
    fetchHistory();
  }, [fetchTrending, fetchHistory]);

  // Search on query change
  useEffect(() => {
    if (query) {
      setSearchInput(query);
      fetchResults(query);
    }
  }, [query, fetchResults]);

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/customer/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  // Handle trending/history click
  const handleQuickSearch = (q: string) => {
    setSearchInput(q);
    router.push(`/customer/search?q=${encodeURIComponent(q)}`);
  };

  // Submit demand request
  const handleDemandSubmit = async () => {
    if (!demandQuery.trim() || !user?.id) return;
    try {
      await fetch("/api/demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: user.id,
          query: demandQuery,
          locationId: user.location || "lusaka",
        }),
      });
      setDemandSubmitted(true);
      setTimeout(() => {
        setShowDemandModal(false);
        setDemandSubmitted(false);
        setDemandQuery("");
      }, 2000);
    } catch (e) {
      console.error("Failed to submit demand:", e);
    }
  };

  const getShopName = (shopId: string | { id: string; name: string; locationId?: string; rating?: number }) => {
    if (typeof shopId === "object" && shopId?.name) return shopId.name;
    return "";
  };

  const getShopId = (shopId: string | { id: string; name: string; locationId?: string; rating?: number }) => {
    if (typeof shopId === "object" && shopId?.id) return shopId.id;
    if (typeof shopId === "string") return shopId;
    return "";
  };

  const productToModalData = (p: SearchResult): ProductData => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    price: p.price,
    originalPrice: p.originalPrice,
    discount: p.discount,
    images: [],
    category: p.category,
    stock: p.stock,
    isAvailable: p.isAvailable,
    shopId: p.shopId as ProductData["shopId"],
    views: p.views,
    rating: p.rating,
    reviews: p.reviews,
    tags: p.tags,
    createdAt: p.createdAt,
    updatedAt: p.createdAt,
  });

  const noResults = results && results.totalCount === 0 && !loading;
  const hasResults = results && results.totalCount > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Search" />

      <main className="p-3 sm:p-4 space-y-4 max-w-2xl mx-auto">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products, shops, categories..."
            className="pl-10 pr-10 h-11 bg-muted/50 border-border"
            autoFocus
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); setResults(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* Trending Searches (show when no query) */}
        {!query && !loading && (
          <div className="space-y-4">
            {/* Recent Searches */}
            {searchHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Searches
                </h3>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickSearch(h.query)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-primary/10 hover:text-brand rounded-lg text-xs font-medium transition-colors"
                    >
                      <Clock className="h-3 w-3" />
                      {h.query}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending */}
            {trending.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-4 w-4 text-brand" />
                  Trending Searches
                </h3>
                <div className="space-y-1">
                  {trending.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickSearch(t.query)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left"
                    >
                      <TrendingUp className="h-3.5 w-3.5 text-brand shrink-0" />
                      <span className="flex-1 font-medium">{t.query}</span>
                      <span className="text-[10px] text-muted-foreground">{t.count}x</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Categories */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Tag className="h-4 w-4 text-brand" />
                Quick Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {["Mobile Phones", "Shoes", "Fashion", "Electronics", "Groceries", "Health", "Gaming", "Furniture"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleQuickSearch(cat)}
                    className="px-3 py-1.5 bg-muted/50 hover:bg-primary/10 hover:text-brand rounded-lg text-xs font-medium transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-20" /><Skeleton className="h-3 w-20" /><div className="flex gap-2"><Skeleton className="h-2 w-10" /><Skeleton className="h-2 w-10" /></div></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Results */}
        {hasResults && !loading && (
          <>
            {/* Result count & tabs */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {results.totalCount} result{results.totalCount !== 1 ? "s" : ""} for &quot;{query}&quot;
              </p>
              <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
                {(["all", "products", "shops", "locations"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-colors capitalize",
                      activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Products */}
            {(activeTab === "all" || activeTab === "products") && results.products.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <ShoppingBag className="h-4 w-4 text-brand" />
                    Products
                  </h3>
                )}
                <div className="space-y-2">
                  {results.products.map((product) => {
                    const shopObj = typeof product.shopId === 'object' ? product.shopId : null;
                    const shopLocId = shopObj?.locationId || 'soweto';
                    const shopPhone = (shopObj as Record<string, unknown>)?.phone as string || '';
                    return (
                      <div key={product.id} className="bg-card border border-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => router.push(`/customer/locations/${shopLocId}${shopObj?.id ? `?shopId=${shopObj.id}` : ''}`)}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          {/* Product Image Placeholder */}
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
                            <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm truncate">{product.name}</h4>
                              {product.discount && product.discount > 0 && (
                                <Badge className="text-[9px] h-4 bg-rose-500/10 text-rose-400 border-0 shrink-0">
                                  -{product.discount}%
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1 mt-0.5">
                              <Store className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground truncate">
                                {getShopName(product.shopId)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] text-muted-foreground capitalize">{product.category}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-sm font-bold text-brand">K{product.price.toLocaleString()}</span>
                              {product.originalPrice && (
                                <span className="text-[10px] text-muted-foreground line-through">
                                  K{product.originalPrice.toLocaleString()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                              <div className="flex items-center gap-0.5">
                                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                <span>{product.rating}</span>
                              </div>
                              <span>({product.reviews})</span>
                              <span>·</span>
                              <span>{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                        {/* Action buttons */}
                        {product.isAvailable && shopObj?.id && (
                          <div className="flex border-t border-border">
                            <button onClick={(e) => { e.stopPropagation(); if (shopPhone) window.open(`tel:${shopPhone}`, '_self'); }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-r border-border">
                              <Phone className="h-3 w-3" /> Contact
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDealModal({ open: true, product }); }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium text-brand hover:bg-primary/5 transition-colors">
                              <ShoppingBag className="h-3 w-3" /> Make Deal
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shops */}
            {(activeTab === "all" || activeTab === "shops") && results.shops.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Store className="h-4 w-4 text-brand" />
                    Shops
                  </h3>
                )}
                <div className="space-y-2">
                  {results.shops.map((shop) => (
                    <Card
                      key={shop.id}
                      className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer"
                      onClick={() => router.push(`/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}`)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-gradient-to-br from-teal-500 to-primary rounded-lg flex items-center justify-center shrink-0">
                            <Store className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-medium text-sm truncate">{shop.name}</h4>
                              {shop.status === "verified" && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground capitalize">{shop.locationId}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                              <div className="flex items-center gap-0.5">
                                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                <span>{shop.rating || "—"}</span>
                              </div>
                              <span>({shop.totalReviews} reviews)</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {shop.specialties.slice(0, 3).map((s) => (
                                <Badge key={s} variant="secondary" className="text-[9px] h-4">{s}</Badge>
                              ))}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Locations */}
            {(activeTab === "all" || activeTab === "locations") && results.locations.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <MapPin className="h-4 w-4 text-brand" />
                    Locations
                  </h3>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {results.locations.map((loc) => (
                    <Card
                      key={loc.id}
                      className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer"
                      onClick={() => router.push(`/customer/locations/${loc.slug}`)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
                          <h4 className="font-medium text-xs truncate">{loc.name}</h4>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{loc.shopCount} shops</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {loc.specialties.slice(0, 2).map((s) => (
                            <Badge key={s} variant="outline" className="text-[8px] h-3">{s}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* "Can't find what you're looking for?" */}
            {noResults && (
              <Card className="bg-card border-border border-dashed">
                <CardContent className="p-4 text-center space-y-3">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-sm font-semibold">Can&apos;t find what you&apos;re looking for?</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Let shops know what you need. They&apos;ll check their stock or restock for you.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setDemandQuery(query);
                      setShowDemandModal(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Create Request
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* "Can't find it?" prompt when results are few */}
        {hasResults && !loading && results.totalCount <= 3 && results.totalCount > 0 && (
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-brand" />
                  <div>
                    <p className="text-xs font-medium">Not finding what you need?</p>
                    <p className="text-[10px] text-muted-foreground">Create a request so shops can find it for you</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] shrink-0"
                  onClick={() => { setDemandQuery(query); setShowDemandModal(true); }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Request
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={productToModalData(selectedProduct)}
          shopName={getShopName(selectedProduct.shopId)}
          onMakeDeal={(p) => {
            setSelectedProduct(null);
            setDealModal({ open: true, product: selectedProduct });
          }}
        />
      )}

      {/* Deal Modal */}
      {dealModal.open && dealModal.product && (
        <DealModal
          isOpen={dealModal.open}
          onClose={() => setDealModal({ open: false, product: null })}
          productName={dealModal.product.name}
          productPrice={dealModal.product.price}
          shopName={getShopName(dealModal.product.shopId)}
          onSendDeal={async (data) => {
            if (!user?.id || !dealModal.product) return;
            const shopObj = typeof dealModal.product.shopId === 'object' ? dealModal.product.shopId : null;
            const ownerId = shopObj?.id || '';
            if (!ownerId) return;
            try {
              // Always create a new deal chat
              const createRes = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "deal",
                  participants: [user.id, ownerId],
                  dealInfo: { productName: dealModal.product.name, productId: dealModal.product.id, quantity: data.quantity, initialPrice: data.suggestedPrice, status: "pending" },
                }),
              });
              const createJson = await createRes.json();
              const chatId = createJson.chat?.id;
              // Send the deal message
              if (chatId) {
                await fetch("/api/chat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chatId,
                    senderId: user.id,
                    senderName: `${user.firstName} ${user.lastName}`,
                    senderRole: "customer",
                    content: data.message,
                    type: "deal_update",
                  }),
                });
              }
              setDealModal({ open: false, product: null });
              router.push(chatId ? `/customer/chat?chatId=${chatId}` : "/customer/chat");
            } catch (e) {
              console.error("Failed to send deal:", e);
            }
          }}
        />
      )}

      {/* Demand Request Modal */}
      {showDemandModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDemandModal(false)} />
          <div className="relative bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-4 animate-slide-up">
            {demandSubmitted ? (
              <div className="text-center py-6">
                <div className="h-12 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShoppingBag className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="font-semibold">Request Submitted!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Shops near you will see your request and respond if they have the product.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold text-sm">Create a Product Request</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Describe what you&apos;re looking for. Shops will be notified.
                  </p>
                </div>

                <Input
                  value={demandQuery}
                  onChange={(e) => setDemandQuery(e.target.value)}
                  placeholder="e.g. Nike Air Force 1, size 42, black"
                  className="h-11"
                  autoFocus
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10"
                    onClick={() => setShowDemandModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-10 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleDemandSubmit}
                    disabled={!demandQuery.trim()}
                  >
                    Submit Request
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page with Suspense boundary ──
export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
}
