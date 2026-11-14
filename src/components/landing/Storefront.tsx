"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Package,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Truck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ProductDetailModal from "@/components/ProductDetailModal";
import CartPanel from "@/components/cart/CartPanel";
import Breadcrumbs from "@/components/site/Breadcrumbs";
import { useLocations, useProductFacets, useProducts, type ProductData } from "@/hooks/useApi";
import { productShopName } from "@/lib/product";
import { cartLineFromProduct } from "@/lib/cart";
import { categoryFilter } from "@/lib/storeCategories";
import { useCartStore } from "@/store/cartStore";
import Container from "./Container";
import FilterPanel, { type FilterState } from "./FilterPanel";
import Hero from "./Hero";
import ProductCard from "./ProductCard";

const TRUST_ITEMS = [
  { icon: Truck, title: "Fast Delivery", detail: "Across Zambia" },
  { icon: ShieldCheck, title: "Secure Payments", detail: "Cash on delivery or pickup" },
  { icon: RotateCcw, title: "Easy Returns", detail: "Agree returns with the shop" },
  { icon: Headphones, title: "Customer Support", detail: "Chat with shops directly" },
];

const SORT_OPTIONS = {
  popular: { label: "Most Popular", sort: "views", order: "desc" },
  newest: { label: "Newest", sort: "createdAt", order: "desc" },
  rating: { label: "Top Rated", sort: "rating", order: "desc" },
  "price-low": { label: "Price: Low to High", sort: "price", order: "asc" },
  "price-high": { label: "Price: High to Low", sort: "price", order: "desc" },
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

const PAGE_SIZE = 12;
const productGrid = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

function ProductSkeletons({ count }: { count: number }) {
  return (
    <div className={productGrid}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function numberParam(value: string | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export default function Storefront() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const addItem = useCartStore((state) => state.addItem);
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters live in the URL so links, refresh and Back all keep them.
  const search = params.get("q") || "";
  const filters: FilterState = {
    categories: params.getAll("category").filter((value) => value && value !== "all"),
    brands: params.getAll("brand").filter(Boolean),
    market: params.get("market") || "all",
    inStock: params.get("stock") === "1",
    onSale: params.get("sale") === "1",
    min: numberParam(params.get("min")),
    max: numberParam(params.get("max")),
  };
  const sortParam = params.get("sort") || "";
  const sortKey: SortKey = sortParam in SORT_OPTIONS ? (sortParam as SortKey) : "popular";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const replaceQuery = (next: URLSearchParams) => {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setFilters = (patch: Partial<FilterState>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    const lists: Array<[keyof FilterState, string]> = [["categories", "category"], ["brands", "brand"]];
    lists.forEach(([key, name]) => {
      if (!(key in patch)) return;
      next.delete(name);
      (patch[key] as string[]).forEach((value) => next.append(name, value));
    });
    if ("market" in patch) {
      if (patch.market && patch.market !== "all") next.set("market", patch.market);
      else next.delete("market");
    }
    const flags: Array<[keyof FilterState, string]> = [["inStock", "stock"], ["onSale", "sale"]];
    flags.forEach(([key, name]) => {
      if (key in patch) {
        if (patch[key]) next.set(name, "1");
        else next.delete(name);
      }
    });
    const bounds: Array<[keyof FilterState, string]> = [["min", "min"], ["max", "max"]];
    bounds.forEach(([key, name]) => {
      if (key in patch) {
        const value = patch[key] as number | null;
        if (value === null) next.delete(name);
        else next.set(name, String(value));
      }
    });
    replaceQuery(next);
  };

  const setParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    replaceQuery(next);
  };

  const clearAll = () => {
    const next = new URLSearchParams();
    if (params.get("sort")) next.set("sort", params.get("sort")!);
    replaceQuery(next);
  };

  const { data: locationData } = useLocations();
  const markets = (locationData?.locations || []).map((location) => ({ id: location.id, name: location.name }));
  const { data: facets } = useProductFacets();

  const { data, loading, error, refetch } = useProducts({
    category: filters.categories.length ? [...new Set(filters.categories.flatMap((value) => [categoryFilter(value)].flat()))] : undefined,
    search: search || undefined,
    locationId: filters.market === "all" ? undefined : filters.market,
    onSale: filters.onSale,
    inStock: filters.inStock,
    brands: filters.brands,
    minPrice: filters.min ?? undefined,
    maxPrice: filters.max ?? undefined,
    sort: SORT_OPTIONS[sortKey].sort,
    order: SORT_OPTIONS[sortKey].order,
    page,
    limit: PAGE_SIZE,
    available: true,
    hasMedia: true,
  });

  const products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const handleAddToCart = (product: ProductData) => {
    const line = cartLineFromProduct(product);
    if (!line) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem(line);
    toast.success(`${product.name} added to cart`);
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(params.toString());
    if (nextPage > 1) next.set("page", String(nextPage));
    else next.delete("page");
    replaceQuery(next);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chips: Array<{ label: string; remove: () => void }> = [];
  if (search) chips.push({ label: `"${search}"`, remove: () => setParam("q", null) });
  filters.categories.forEach((value) =>
    chips.push({ label: value, remove: () => setFilters({ categories: filters.categories.filter((item) => item !== value) }) })
  );
  filters.brands.forEach((value) =>
    chips.push({ label: value, remove: () => setFilters({ brands: filters.brands.filter((item) => item !== value) }) })
  );
  if (filters.market !== "all") {
    chips.push({ label: markets.find((item) => item.id === filters.market)?.name || "Market", remove: () => setFilters({ market: "all" }) });
  }
  if (filters.min !== null || filters.max !== null) {
    chips.push({ label: `K${filters.min ?? 0} – ${filters.max !== null ? `K${filters.max}` : "any"}`, remove: () => setFilters({ min: null, max: null }) });
  }
  if (filters.inStock) chips.push({ label: "In stock", remove: () => setFilters({ inStock: false }) });
  if (filters.onSale) chips.push({ label: "On sale", remove: () => setFilters({ onSale: false }) });

  // A single category or search reads as a place: Home > Electronics.
  const trail = filters.categories.length === 1
    ? [{ label: filters.categories[0] }]
    : filters.onSale
      ? [{ label: "Deals" }]
      : search
        ? [{ label: `Search: ${search}` }]
        : null;

  const filterPanel = (
    <FilterPanel filters={filters} facets={facets} markets={markets} onChange={setFilters} onClear={clearAll} />
  );

  return (
    <Container className="max-w-[1440px] pb-10 pt-4 sm:pb-14 sm:pt-5">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Hero />

          <div id="products" className="grid scroll-mt-24 items-start gap-5 md:grid-cols-[14.5rem_minmax(0,1fr)] xl:grid-cols-[15.5rem_minmax(0,1fr)]">
            <div className="hidden md:block">{filterPanel}</div>

            <section aria-label="Products" className="min-w-0">
              {trail && <Breadcrumbs items={trail} className="mb-2" />}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-brand sm:text-[28px]">
                    {filters.onSale ? "Deals" : filters.categories.length === 1 ? filters.categories[0] : "Our Products"}
                  </h2>
                  <p aria-live="polite" className="text-sm text-muted-foreground">
                    {loading && !data ? "Finding products..." : `${total.toLocaleString()} ${total === 1 ? "product" : "products"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-brand md:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" /> Filters{chips.length > 0 && ` (${chips.length})`}
                  </button>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <span className="hidden sm:inline">Sort by:</span>
                    <span className="relative">
                      <select
                        value={sortKey}
                        aria-label="Sort products"
                        onChange={(event) => setParam("sort", event.target.value === "popular" ? null : event.target.value)}
                        className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-9 text-sm font-semibold text-brand outline-none focus:border-brand/40"
                      >
                        {Object.entries(SORT_OPTIONS).map(([value, option]) => (
                          <option key={value} value={value}>{option.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" />
                    </span>
                  </label>
                </div>
              </div>

              {chips.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {chips.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={chip.remove}
                      aria-label={`Remove filter ${chip.label}`}
                      className="flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/15"
                    >
                      {chip.label}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  <button onClick={clearAll} className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    Clear all
                  </button>
                </div>
              )}

              {error && !data ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                  <p className="font-semibold">We could not load products</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>Try again</Button>
                </div>
              ) : loading && !data ? (
                <ProductSkeletons count={6} />
              ) : products.length > 0 ? (
                <div className={`${productGrid} transition-opacity ${loading ? "opacity-60" : ""}`}>
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} onOpen={setSelectedProduct} onAddToCart={handleAddToCart} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                  <Package className="mx-auto h-9 w-9 text-muted-foreground" />
                  <p className="mt-3 font-semibold">No products found</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Try a different search or fewer filters.</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearAll}>Clear filters</Button>
                </div>
              )}

              {totalPages > 1 && (
                <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </nav>
              )}
            </section>
          </div>
        </div>

        <CartPanel className="hidden lg:sticky lg:top-24 lg:block" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Why shop with us" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="flex items-center gap-3 rounded-2xl bg-brand-soft p-3.5 dark:bg-muted sm:px-5 sm:py-4">
              <item.icon className="h-8 w-8 shrink-0 text-brand" strokeWidth={1.7} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-brand">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </section>
        <Link
          href="/?sale=1#products"
          className="group flex items-center justify-between gap-3 rounded-2xl bg-[#002583] px-5 py-4 text-white"
        >
          <span className="flex items-center gap-3">
            <Tag className="h-9 w-9 shrink-0 text-[#ffb800]" />
            <span className="text-lg font-bold leading-tight">Great Deals<br />Everyday!</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#ffb800] px-4 py-2 text-sm font-semibold text-[#002583] transition-colors group-hover:bg-[#ffc733]">
            Shop Deals <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[88%] max-w-sm overflow-y-auto p-3">
          <SheetTitle className="sr-only">Filters</SheetTitle>
          <div className="pt-8">{filterPanel}</div>
          <Button className="w-full rounded-xl" onClick={() => setFiltersOpen(false)}>
            Show {total.toLocaleString()} {total === 1 ? "product" : "products"}
          </Button>
        </SheetContent>
      </Sheet>

      {selectedProduct && (
        <ProductDetailModal
          isOpen
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          shopName={productShopName(selectedProduct)}
          primaryActionLabel="Add to Cart"
          onPrimaryAction={(product) => {
            handleAddToCart(product);
            setSelectedProduct(null);
          }}
        />
      )}
    </Container>
  );
}
