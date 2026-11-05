"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, TrendingUp, MapPin, Store, Star, ShoppingBag, Loader2,
  X, Clock, MessageSquare, Tag, ChevronRight, AlertCircle, Plus,
  Image, Camera, Send, Phone, Heart, MessageCircle, Package
} from "lucide-react";
import ProductDetailModal from "./ProductDetailModal";
import DealModal from "./DealModal";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpload } from "@/hooks/useUpload";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import VerifiedBadge from "./VerifiedBadge";
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

interface PostResult {
  id: string;
  content: string;
  author: { id: string; name: string; role: string } | null;
  likes: number;
  commentsCount: number;
  isPromotion: boolean;
  postType: string;
  product?: { name: string; price: number; shopId: string };
  createdAt: string;
}

interface TrendingItem {
  query: string;
  count: number;
}

interface SearchData {
  products: SearchResult[];
  shops: ShopResult[];
  posts: PostResult[];
  totalCount: number;
  keywords: {
    query: string;
    tokens: string[];
    brands: string[];
    colors: string[];
    category: string | null;
    priceMax: number | null;
  };
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const RELEVANCE_THRESHOLD = 50;

// ── Highlight matching text ──
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;
  const regex = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-brand font-medium rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchData | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [demandQuery, setDemandQuery] = useState("");
  const [demandMessage, setDemandMessage] = useState("");
  const [demandPhotos, setDemandPhotos] = useState<string[]>([]);
  const [demandSubmitting, setDemandSubmitting] = useState(false);
  const [demandSubmitted, setDemandSubmitted] = useState(false);
  const [searchHistory, setSearchHistory] = useState<{ query: string; timestamp: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "products" | "shops" | "posts">("all");

  // Deal modal
  const [dealModal, setDealModal] = useState<{ open: boolean; product: SearchResult | null; shopOwnerId: string }>({ open: false, product: null, shopOwnerId: "" });
  const router = useRouter();

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch("/api/search/trending?limit=4");
      const data = await res.json();
      setTrending(data.trending || []);
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/search/history?userId=${user.id}&limit=3`);
      const data = await res.json();
      setSearchHistory(data.history || []);
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      fetchTrending();
      fetchHistory();
    } else {
      setQuery("");
      setResults(null);
      setActiveTab("all");
    }
  }, [isOpen, fetchTrending, fetchHistory]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "10" });
        if (user?.id) params.set("userId", user.id);
        const res = await fetch(`/api/search/v2?${params}`);
        const data = await res.json();
        setResults(data);
      } catch { setResults(null); } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, user?.id]);

  const relevantProducts = results?.products.filter((p) => p.score >= RELEVANCE_THRESHOLD) || [];
  const hasResults = relevantProducts.length > 0 || (results?.shops?.length || 0) > 0 || (results?.posts?.length || 0) > 0;
  const searchDone = results && !loading;

  // Submit demand + create post
  const handleDemandSubmit = async () => {
    if (!demandQuery.trim() || !user?.id) return;
    setDemandSubmitting(true);
    try {
      // Create demand record
      await fetch("/api/demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: user.id, query: demandQuery, locationId: user.location || "lusaka" }),
      });
      // Create feed post
      const content = `🔍 Looking for: ${demandQuery}${demandMessage ? `\n\n${demandMessage}` : ""}`;
      await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, authorId: user.id, locationId: user.location || "lusaka", images: demandPhotos, postType: "customer_request" }),
      });
      setDemandSubmitted(true);
      setTimeout(() => { setShowDemandModal(false); setDemandSubmitted(false); setDemandQuery(""); setDemandMessage(""); setDemandPhotos([]); onClose(); }, 1500);
    } catch {} finally { setDemandSubmitting(false); }
  };

  // Photo picker
  const handlePhotoPick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "pakalale/demand");
        formData.append("type", "image");
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          if (res.ok) {
            const data = await res.json();
            setDemandPhotos((prev) => [...prev, data.url]);
          }
        } catch (err) {
          console.error("Upload failed:", err);
        }
      }
    };
    input.click();
  };

  const getShopOwnerId = (shopId: SearchResult["shopId"]): string => {
    if (typeof shopId === "object" && shopId?.id) return shopId.id;
    return "";
  };

  const getShopName = (shopId: SearchResult["shopId"]): string => {
    if (typeof shopId === "object" && shopId?.name) return shopId.name;
    return "";
  };

  const productToModalData = (p: SearchResult): ProductData => ({
    id: p.id, name: p.name, description: p.description || "", price: p.price,
    originalPrice: p.originalPrice, discount: p.discount, images: [],
    category: p.category, stock: p.stock, isAvailable: p.isAvailable,
    shopId: p.shopId as ProductData["shopId"], views: p.views, rating: p.rating,
    reviews: p.reviews, tags: p.tags, createdAt: p.createdAt, updatedAt: p.createdAt,
  });

  const getShopPhone = (shopId: SearchResult["shopId"]): string => {
    if (typeof shopId === "object" && "phone" in shopId) return (shopId as { phone?: string }).phone || "";
    return "";
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={cn("fixed inset-0 z-[60] flex flex-col transition-colors", dealModal.open ? "bg-transparent pointer-events-none" : "bg-background")} onClick={dealModal.open ? undefined : onClose}>
        {!dealModal.open && (
          <>
        {/* Search bar */}
        <div className="bg-background border-b border-border px-3 py-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, shops, posts..."
              className="w-full pl-10 pr-10 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />
            {query && (
              <button type="button" onClick={() => { setQuery(""); setResults(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full" onClick={(e) => e.stopPropagation()}>
          <div className="p-3 space-y-4">

            {/* Empty state */}
            {!query && !loading && (
              <>
                {searchHistory.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Recent</h3>
                    <div className="space-y-0.5">
                      {searchHistory.slice(0, 3).map((h, i) => (
                        <button key={i} onClick={() => setQuery(h.query)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{h.query}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {trending.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><TrendingUp className="h-3 w-3 text-brand" /> Trending</h3>
                    <div className="space-y-0.5">
                      {trending.slice(0, 4).map((t, i) => (
                        <button key={i} onClick={() => setQuery(t.query)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left">
                          <TrendingUp className="h-3.5 w-3.5 text-brand shrink-0" />
                          <span className="flex-1 font-medium truncate">{t.query}</span>
                          <span className="text-[10px] text-muted-foreground">{t.count}x</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Tag className="h-3 w-3 text-brand" /> Popular</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {["Phones", "Shoes", "Fashion", "Electronics", "Groceries", "Health", "Gaming", "Furniture"].map((cat) => (
                      <button key={cat} onClick={() => setQuery(cat)}
                        className="px-2.5 py-1.5 bg-muted/50 hover:bg-primary/10 hover:text-brand rounded-lg text-xs font-medium transition-colors">{cat}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {loading && (
              <div className="space-y-3">
                <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5"><Skeleton className="h-7 flex-1 rounded-md" /><Skeleton className="h-7 flex-1 rounded-md" /><Skeleton className="h-7 flex-1 rounded-md" /><Skeleton className="h-7 flex-1 rounded-md" /></div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-20" /><Skeleton className="h-3 w-20" /><div className="flex gap-2"><Skeleton className="h-2 w-10" /><Skeleton className="h-2 w-10" /></div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {searchDone && (
              <>
                {/* Tabs */}
                {hasResults && (
                  <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
                    {(["all", "products", "shops", "posts"] as const).map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={cn("flex-1 px-2 py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-colors capitalize",
                          activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {tab}
                      </button>
                    ))}
                  </div>
                )}

                {/* Products */}
                {(activeTab === "all" || activeTab === "products") && relevantProducts.length > 0 && (
                  <div>
                    {activeTab === "all" && <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><ShoppingBag className="h-3 w-3 text-brand" /> Products</h3>}
                    <div className="space-y-1.5">
                      {relevantProducts.slice(0, 5).map((product) => {
                        const shopOwnerId = getShopOwnerId(product.shopId);
                        const shopName = getShopName(product.shopId);
                        return (
                          <div key={product.id} className="bg-card border border-border rounded-lg overflow-hidden">
                            <button onClick={() => {
                              const shopLocId = typeof product.shopId === 'object' && product.shopId?.locationId ? product.shopId.locationId : 'soweto';
                              const shopId = typeof product.shopId === 'object' ? product.shopId.id : '';
                              onClose();
                              router.push(`/customer/locations/${shopLocId}${shopId ? `?shopId=${shopId}` : ''}`);
                            }}
                              className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors">
                              <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center shrink-0 relative">
                                <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
                                {!product.isAvailable && (
                                  <div className="absolute inset-0 bg-background/70 rounded-lg flex items-center justify-center">
                                    <span className="text-[8px] font-bold text-destructive">OUT</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">
                                  <Highlight text={product.name} tokens={results!.keywords.tokens} />
                                </h4>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Store className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground truncate">{shopName}</span>
                                  <span className="text-[10px] text-muted-foreground">·</span>
                                  <span className="text-[10px] text-muted-foreground capitalize">{product.category}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-sm font-bold text-brand">K{product.price.toLocaleString()}</span>
                                  {product.originalPrice && <span className="text-[10px] text-muted-foreground line-through">K{product.originalPrice.toLocaleString()}</span>}
                                  {product.discount && product.discount > 0 && <Badge className="text-[8px] h-3.5 px-1 bg-rose-500/10 text-rose-400 border-0">-{product.discount}%</Badge>}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                  <div className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" /><span>{product.rating}</span></div>
                                  <span>({product.reviews})</span>
                                  <span>·</span>
                                  {product.isAvailable && product.stock > 0 ? (
                                    <span className="text-emerald-500 font-medium">In Stock ({product.stock})</span>
                                  ) : (
                                    <span className="text-destructive font-medium">Out of Stock</span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </button>
                            {/* Deal / Contact buttons */}
                            {product.isAvailable && shopOwnerId && (
                              <div className="flex border-t border-border">
                                <button onClick={(e) => { e.stopPropagation(); const phone = getShopPhone(product.shopId); if (phone) window.open(`tel:${phone}`, '_self'); }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-r border-border">
                                  <Phone className="h-3 w-3" /> Contact
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setDealModal({ open: true, product, shopOwnerId }); }}
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
                {(activeTab === "all" || activeTab === "shops") && (results?.shops?.length || 0) > 0 && (
                  <div>
                    {activeTab === "all" && <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Store className="h-3 w-3 text-brand" /> Shops</h3>}
                    <div className="space-y-1.5">
                      {results!.shops.slice(0, 3).map((shop) => (
                        <button key={shop.id}
                          onClick={() => { onClose(); router.push(`/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}`); }}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left bg-card border border-border">
                          <div className="h-10 w-10 bg-gradient-to-br from-teal-500 to-primary rounded-lg flex items-center justify-center shrink-0">
                            <Store className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <h4 className="font-medium text-sm truncate">
                                <Highlight text={shop.name} tokens={results!.keywords.tokens} />
                              </h4>
                              {shop.status === "verified" && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <MapPin className="h-2.5 w-2.5" /><span className="capitalize">{shop.locationId}</span>
                              <span>·</span><Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" /><span>{shop.rating || "—"}</span>
                              <span>({shop.totalReviews})</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {shop.specialties.slice(0, 3).map((s) => <Badge key={s} variant="secondary" className="text-[8px] h-3.5">{s}</Badge>)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posts */}
                {(activeTab === "all" || activeTab === "posts") && (results?.posts?.length || 0) > 0 && (
                  <div>
                    {activeTab === "all" && <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><MessageSquare className="h-3 w-3 text-brand" /> Posts</h3>}
                    <div className="space-y-1.5">
                      {results!.posts.slice(0, 3).map((post) => (
                        <button key={post.id} className="w-full bg-card border border-border rounded-lg p-3 text-left hover:bg-muted/30 transition-colors"
                          onClick={() => {
                            if (post.author?.id) {
                              onClose();
                              router.push(`/customer/profile/${post.author.id}`);
                            }
                          }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="h-7 w-7 bg-gradient-to-br from-primary to-amber-golden rounded-full flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">
                              {post.author?.name?.[0] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium">{post.author?.name || "User"}</span>
                              {post.isPromotion && <Badge className="ml-1 text-[8px] h-3 px-1 bg-emerald-500/10 text-emerald-500 border-0">Promo</Badge>}
                            </div>
                          </div>
                          <p className="text-xs leading-relaxed line-clamp-3">
                            <Highlight text={post.content} tokens={results!.keywords.tokens} />
                          </p>
                          {post.product && (
                            <div className="mt-2 flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs font-medium">{post.product.name}</span>
                              <span className="text-xs font-bold text-brand">K{post.product.price.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {post.likes}</span>
                            <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {post.commentsCount}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No results */}
                {!hasResults && (
                  <div className="text-center py-8 space-y-3">
                    <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                      <Package className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">No results for &quot;{query}&quot;</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                        We couldn&apos;t find anything matching your search. Create a request and shops will try to help.
                      </p>
                    </div>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => { setDemandQuery(query); setShowDemandModal(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Request
                    </Button>
                  </div>
                )}

                {/* Few results CTA */}
                {hasResults && relevantProducts.length <= 2 && relevantProducts.length > 0 && (
                  <button onClick={() => { setDemandQuery(query); setShowDemandModal(true); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-muted/30 hover:bg-muted/50 rounded-lg text-xs text-muted-foreground transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" /> Not finding what you need? Create a request
                  </button>
                )}
              </>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)}
          product={productToModalData(selectedProduct)} shopName={getShopName(selectedProduct.shopId)}
          onMakeDeal={() => setSelectedProduct(null)} />
      )}

      {/* Deal Modal */}
      {dealModal.open && dealModal.product && (
        <DealModal isOpen={dealModal.open} onClose={() => setDealModal({ open: false, product: null, shopOwnerId: "" })}
          productName={dealModal.product.name} productPrice={dealModal.product.price}
          shopName={getShopName(dealModal.product.shopId)}
          onSendDeal={async (data) => {
            if (!user?.id) return;
            const ownerId = dealModal.shopOwnerId;
            if (!ownerId) return;
            try {
              // Always create a new deal chat
              const createRes = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "deal",
                  participants: [user.id, ownerId],
                  dealInfo: { productName: dealModal.product!.name, productId: dealModal.product!.id, quantity: data.quantity, initialPrice: data.suggestedPrice, status: "pending" },
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
              setDealModal({ open: false, product: null, shopOwnerId: "" });
              onClose();
              router.push(chatId ? `/customer/chat?chatId=${chatId}` : "/customer/chat");
            } catch (e) {
              console.error("Failed to send deal:", e);
            }
          }}
        />
      )}

      {/* Demand / Request Modal with photos */}
      {showDemandModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDemandModal(false)} />
          <div className="relative bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3 animate-slide-up max-h-[85vh] overflow-y-auto">
            {demandSubmitted ? (
              <div className="text-center py-6">
                <div className="h-12 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Send className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-sm">Posted & Requested!</h3>
                <p className="text-xs text-muted-foreground mt-1">Your request is now visible in the feed. Shops will be notified.</p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold text-sm">What are you looking for?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">This will be posted to the feed and sent to nearby shops.</p>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs text-muted-foreground">🔍</span>
                  <input value={demandQuery} onChange={(e) => setDemandQuery(e.target.value)}
                    placeholder="e.g. Nike Air Force 1, size 42, black"
                    className="w-full pl-8 pr-3 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>

                <Textarea value={demandMessage} onChange={(e) => setDemandMessage(e.target.value)}
                  placeholder="Any extra details? Budget, preferred shop, urgency..."
                  rows={2} className="resize-none text-sm" />

                {/* Photo previews */}
                {demandPhotos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {demandPhotos.map((img, i) => (
                      <div key={i} className="relative shrink-0">
                        <img src={img} className="h-16 w-16 object-cover rounded-lg" alt="" />
                        <button onClick={() => setDemandPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 bg-background/80 rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Photo add button */}
                <button onClick={handlePhotoPick}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 rounded-lg text-xs text-muted-foreground transition-colors w-full justify-center">
                  <Camera className="h-4 w-4" /> Add Photos (optional)
                </button>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1 h-10" onClick={() => setShowDemandModal(false)}>Cancel</Button>
                  <Button className="flex-1 h-10 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleDemandSubmit} disabled={!demandQuery.trim() || demandSubmitting}>
                    {demandSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
                    Post & Request
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
