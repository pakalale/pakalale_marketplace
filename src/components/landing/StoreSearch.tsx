"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Package, Search, Store, TrendingUp, X } from "lucide-react";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ProductDetailModal from "@/components/ProductDetailModal";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { cartLineFromProduct } from "@/lib/cart";
import type { ProductData } from "@/hooks/useApi";
import ProductCard from "./ProductCard";

interface SearchProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  category: string;
  stock: number;
  isAvailable: boolean;
  rating: number;
  reviews: number;
  views: number;
  shopId: string | { id: string; name: string; locationId?: string };
  score: number;
  createdAt: string;
}

interface SearchShop {
  id: string;
  name: string;
  specialties: string[];
  locationId?: string;
  rating?: number;
  totalReviews: number;
}

interface SearchPost {
  id: string;
  content: string;
  author: { id: string; name: string } | null;
  isPromotion: boolean;
}

interface SearchResponse {
  products: SearchProduct[];
  shops: SearchShop[];
  posts: SearchPost[];
}

interface TrendingItem {
  query: string;
  count: number;
}

const RELEVANCE_THRESHOLD = 50;
const POPULAR = ["Phones", "Shoes", "Fashion", "Electronics", "Groceries", "Home", "Gaming", "Beauty"];

function toProductData(result: SearchProduct): ProductData {
  return {
    id: result.id,
    name: result.name,
    description: result.description || "",
    price: result.price,
    originalPrice: result.originalPrice,
    discount: result.discount,
    images: [],
    category: result.category || "",
    stock: result.stock,
    isAvailable: result.isAvailable,
    shopId: result.shopId,
    views: result.views || 0,
    rating: result.rating || 0,
    reviews: result.reviews || 0,
    createdAt: result.createdAt,
    updatedAt: result.createdAt,
  };
}

function shopNameOf(shopId: SearchProduct["shopId"]) {
  return typeof shopId === "object" && shopId ? shopId.name : "";
}

/**
 * Storefront search. It uses the same /api/search endpoint, debounce and
 * trending history as the feed search, but renders storefront product cards so
 * visitors can browse and add to a cart before they have an account.
 */
export default function StoreSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const addItem = useCartStore((state) => state.addItem);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [history, setHistory] = useState<{ query: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);

    // Same suggestions as the feed search: trending for everyone, recent
    // searches only for signed-in visitors.
    (async () => {
      try {
        const trendingRes = await fetch("/api/search/trending?limit=6");
        const trendingData = await trendingRes.json();
        if (!cancelled) setTrending(trendingData.trending || []);
      } catch {
        /* suggestions are optional */
      }

      if (!user?.id) {
        if (!cancelled) setHistory([]);
        return;
      }
      try {
        const historyRes = await fetch(`/api/search/history?userId=${user.id}&limit=4`);
        const historyData = await historyRes.json();
        if (!cancelled) setHistory(historyData.history || []);
      } catch {
        /* history is optional */
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, user?.id]);

  useEffect(() => {
    if (!query.trim()) return;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "12" });
        if (user?.id) params.set("userId", user.id);
        const res = await fetch(`/api/search/v2?${params}`);
        setResults(await res.json());
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query, user?.id]);

  const products = (results?.products || [])
    .filter((product) => product.score >= RELEVANCE_THRESHOLD)
    .map(toProductData);
  const shops = results?.shops || [];
  const posts = results?.posts || [];
  const hasResults = products.length > 0 || shops.length > 0 || posts.length > 0;
  const searchDone = results !== null && !loading;

  const handleAddToCart = (product: ProductData) => {
    const line = cartLineFromProduct(product);
    if (!line) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem(line);
    toast.success(`${product.name} added to cart`);
  };

  const seeAll = () => {
    const trimmed = query.trim();
    onOpenChange(false);
    router.push(trimmed ? `/?q=${encodeURIComponent(trimmed)}#products` : "/#products");
  };

  const openShop = (shop: SearchShop) => {
    onOpenChange(false);
    if (!isAuthenticated) {
      router.push(`/?q=${encodeURIComponent(shop.name)}#products`);
      return;
    }
    router.push(`/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">Search products</DialogTitle>

          <div className="relative border-b border-border p-3 pr-12">
            <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                if (!value.trim()) setResults(null);
              }}
              placeholder="Search products, shops, posts..."
              aria-label="Search products, shops and posts"
              className="h-11 w-full rounded-full border border-border bg-muted/60 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/40 focus:bg-card [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  inputRef.current?.focus();
                }}
                className="absolute right-14 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!query.trim() && (
              <div className="space-y-5">
                {history.length > 0 && (
                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Clock className="h-3 w-3" /> Recent
                    </h3>
                    <div className="space-y-0.5">
                      {history.slice(0, 4).map((item) => (
                        <button
                          key={item.query}
                          type="button"
                          onClick={() => setQuery(item.query)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                        >
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">{item.query}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {trending.length > 0 && (
                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand">
                      <TrendingUp className="h-3 w-3" /> Trending
                    </h3>
                    <div className="space-y-0.5">
                      {trending.map((item) => (
                        <button
                          key={item.query}
                          type="button"
                          onClick={() => setQuery(item.query)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                        >
                          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-brand" />
                          <span className="flex-1 truncate font-medium">{item.query}</span>
                          <span className="text-[10px] font-medium text-muted-foreground">{item.count}x</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Popular</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setQuery(item)}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary/10 hover:text-brand"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand" />
                <span className="text-sm">Searching...</span>
              </div>
            )}

            {searchDone && !hasResults && (
              <div className="py-10 text-center">
                <Package className="mx-auto h-9 w-9 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">No results for &quot;{query}&quot;</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                  Try a different word, or browse all products.
                </p>
                <button
                  type="button"
                  onClick={seeAll}
                  className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Browse all products
                </button>
              </div>
            )}

            {searchDone && hasResults && (
              <div className="space-y-5">
                {products.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Products
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onOpen={setSelectedProduct}
                          onAddToCart={handleAddToCart}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {shops.length > 0 && (
                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Store className="h-3 w-3" /> Shops
                    </h3>
                    <div className="space-y-1.5">
                      {shops.slice(0, 3).map((shop) => (
                        <button
                          key={shop.id}
                          type="button"
                          onClick={() => openShop(shop)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-brand/30"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Store className="h-5 w-5 text-brand" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{shop.name}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {shop.specialties?.slice(0, 3).join(" · ") || "Local shop"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {posts.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Posts</h3>
                    <div className="space-y-1.5">
                      {posts.slice(0, 3).map((post) => (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => {
                            onOpenChange(false);
                            router.push("/feed");
                          }}
                          className="w-full rounded-xl border border-border bg-card p-3 text-left text-xs leading-relaxed transition-colors hover:border-brand/30"
                        >
                          <span className="mb-1 block truncate font-semibold">
                            {post.author?.name || "Community"}
                          </span>
                          <span className="line-clamp-2 text-muted-foreground">{post.content}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <button
                  type="button"
                  onClick={seeAll}
                  className="w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-muted"
                >
                  See all results for &quot;{query.trim()}&quot;
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedProduct && (
        <ProductDetailModal
          isOpen
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          shopName={shopNameOf(selectedProduct.shopId)}
          primaryActionLabel="Add to Cart"
          onPrimaryAction={(product) => {
            handleAddToCart(product);
            setSelectedProduct(null);
          }}
        />
      )}
    </>
  );
}
