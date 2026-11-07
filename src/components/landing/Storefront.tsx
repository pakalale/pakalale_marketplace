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
  Truck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProductDetailModal from "@/components/ProductDetailModal";
import { useLocations, useProducts, type ProductData } from "@/hooks/useApi";
import { productShopName } from "@/lib/product";
import { cartLineFromProduct } from "@/lib/cart";
import { STORE_CATEGORIES, categoryFilter, categoryHref } from "@/lib/storeCategories";
import { useCartStore } from "@/store/cartStore";
import Container from "./Container";
import Hero from "./Hero";
import ProductCard from "./ProductCard";

const TRUST_ITEMS = [
  { icon: Truck, title: "Fast & Reliable Delivery", detail: "Across Zambia" },
  { icon: ShieldCheck, title: "Secure Payments", detail: "Shop with confidence" },
  { icon: Headphones, title: "24/7 Customer Support", detail: "We're here to help" },
  { icon: RotateCcw, title: "Easy Returns", detail: "Hassle-free returns" },
];

const SORT_OPTIONS = {
  newest: { label: "Newest first", sort: "createdAt", order: "desc" },
  popular: { label: "Most popular", sort: "views", order: "desc" },
  rating: { label: "Top rated", sort: "rating", order: "desc" },
  "price-low": { label: "Price: low to high", sort: "price", order: "asc" },
  "price-high": { label: "Price: high to low", sort: "price", order: "desc" },
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

const PAGE_SIZE = 12;
const productGrid = "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4";

function SectionHeading({ title, href, action }: { title: string; href: string; action: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
      <h2 className="shrink-0 text-2xl font-bold tracking-tight text-brand sm:text-[28px]">{title}</h2>
      <span className="hidden h-px flex-1 bg-border sm:block" />
      <Link
        href={href}
        className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[#a86f00] hover:underline dark:text-primary sm:ml-0 min-[420px]:ml-auto"
      >
        {action}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ProductSkeletons({ count }: { count: number }) {
  return (
    <div className={productGrid}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

function uniquePhoto(product: ProductData, usedUrls: Set<string>) {
  const photo = product.images?.find((url) =>
    url && !/\/video\/upload\/|\.(mp4|webm|mov)(\?|$)/i.test(url) && !usedUrls.has(url)
  );
  if (photo) usedUrls.add(photo);
  return photo || null;
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none">
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none truncate rounded-full border border-border bg-card pl-4 pr-9 text-sm font-medium outline-none transition-colors focus:border-brand/40 sm:w-44"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export default function Storefront() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const addItem = useCartStore((state) => state.addItem);
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);

  // Filters live in the URL so search, deals links, refresh and back all work.
  const search = params.get("q") || "";
  const category = params.get("category") || "all";
  const market = params.get("market") || "all";
  const onSale = params.get("sale") === "1";
  const sortParam = params.get("sort") || "";
  const sortKey: SortKey = sortParam in SORT_OPTIONS ? (sortParam as SortKey) : "newest";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const updateFilters = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params.toString());
    if (!keepPage) next.delete("page");
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const { data: locationData } = useLocations();
  const locations = locationData?.locations || [];

  const { data, loading, error, refetch } = useProducts({
    category: category === "all" ? undefined : categoryFilter(category),
    search: search || undefined,
    locationId: market === "all" ? undefined : market,
    onSale,
    sort: SORT_OPTIONS[sortKey].sort,
    order: SORT_OPTIONS[sortKey].order,
    page,
    limit: PAGE_SIZE,
    available: true,
    hasImage: true,
  });

  // "Best sellers" ranks by views: orders are too new to rank on. Photos only,
  // since this rail is the storefront's shop window.
  const { data: bestSellerData, loading: bestSellersLoading } = useProducts({
    sort: "views",
    order: "desc",
    limit: 4,
    available: true,
    hasImage: true,
  });

  const products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const productIdsOnPage = new Set(products.map((product) => product.id));
  const bestSellers = (bestSellerData?.products || []).filter((product) => !productIdsOnPage.has(product.id));
  const usedProductPhotos = new Set<string>();
  const bestSellerCards = bestSellers.map((product) => ({
    product,
    image: uniquePhoto(product, usedProductPhotos),
  }));
  const productCards = products.map((product) => ({
    product,
    image: uniquePhoto(product, usedProductPhotos),
  }));
  const groupLabels = STORE_CATEGORIES.map((group) => group.label);
  const otherCategories = (data?.categories || bestSellerData?.categories || []).filter(
    (item) => !groupLabels.includes(item)
  );
  const hasFilters = Boolean(search) || category !== "all" || market !== "all" || onSale;

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
    updateFilters({ page: nextPage > 1 ? String(nextPage) : null }, true);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeChips: Array<{ label: string; clear: string }> = [];
  if (search) activeChips.push({ label: `"${search}"`, clear: "q" });
  if (category !== "all") activeChips.push({ label: category, clear: "category" });
  if (market !== "all") {
    const name = locations.find((item) => item.id === market)?.name;
    activeChips.push({ label: name || "Market", clear: "market" });
  }
  if (onSale) activeChips.push({ label: "On sale", clear: "sale" });

  return (
    <Container className="space-y-7 pb-10 pt-2 sm:space-y-9 sm:pb-14">
      <Hero />

      <section aria-label="Why shop with us" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="flex items-center gap-3 rounded-2xl bg-[#edf0f9] p-3.5 dark:bg-muted sm:px-5 sm:py-4">
            <item.icon className="h-7 w-7 shrink-0 text-brand sm:h-8 sm:w-8" strokeWidth={1.7} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-brand sm:text-sm">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-[13px]">{item.detail}</p>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="categories">
        <SectionHeading title="Shop by Category" href="/#products" action="View All Categories" />
        <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-7">
          {STORE_CATEGORIES.map((group) => (
            <Link
              key={group.label}
              href={categoryHref(group.label)}
              className="group flex flex-col items-center rounded-2xl bg-[#edf0f9] px-1.5 pb-3 pt-2 text-center transition-shadow hover:shadow-md"
            >
              <img
                src={group.image}
                alt=""
                loading="lazy"
                className="aspect-[5/4] w-full object-contain transition-transform duration-200 group-hover:scale-105"
              />
              <span className="mt-1.5 text-[11px] font-medium leading-tight text-[#0b1736] sm:text-[13px]">
                {group.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {(bestSellersLoading || bestSellerCards.length > 0) && (
        <section aria-label="Best sellers">
          <SectionHeading title="Best Sellers" href="/?sort=popular#products" action="View All Best Sellers" />
          {bestSellersLoading && bestSellerCards.length === 0 ? (
            <ProductSkeletons count={4} />
          ) : (
            <div className={productGrid}>
              {bestSellerCards.map(({ product, image }) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  imageOverride={image}
                  onOpen={setSelectedProduct}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section
        aria-label="Deals"
        className="relative overflow-hidden rounded-3xl bg-[#e5e7f0] md:h-[170px] lg:h-[190px]"
      >
        <img
          src="/landing/deals-bags.webp"
          alt=""
          className="w-full md:absolute md:bottom-0 md:right-0 md:h-full md:w-auto md:max-w-[50%] md:object-cover md:object-left"
        />
        <div className="relative z-10 flex h-full flex-col items-start gap-4 bg-[#002269] px-6 py-6 sm:px-10 md:w-[68%] md:flex-row md:items-center md:justify-between md:rounded-r-[6rem] md:py-0 lg:px-12">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Big Deals. <span className="text-[#ffb800]">Bigger Savings.</span>
            </h2>
            <p className="mt-1.5 text-sm text-white/90 sm:text-base lg:text-lg">
              Real markdowns on selected items from local shops.
            </p>
          </div>
          <Link
            href="/?sale=1#products"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-[#ffb800] px-6 font-semibold text-[#002583] transition-colors hover:bg-[#ffc733]"
          >
            Shop the Sale
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <section id="products" aria-label="All products" className="scroll-mt-24">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-brand sm:text-[28px]">
              {onSale ? "On Sale" : "All Products"}
            </h2>
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {loading && !data ? "Finding products..." : `${total.toLocaleString()} ${total === 1 ? "product" : "products"}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label="Filter by category"
              value={category}
              onChange={(value) => updateFilters({ category: value === "all" ? null : value })}
            >
              <option value="all">All categories</option>
              <optgroup label="Departments">
                {groupLabels.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </optgroup>
              {otherCategories.length > 0 && (
                <optgroup label="All categories">
                  {otherCategories.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </optgroup>
              )}
            </FilterSelect>
            <FilterSelect
              label="Filter by market"
              value={market}
              onChange={(value) => updateFilters({ market: value === "all" ? null : value })}
            >
              <option value="all">All markets</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Sort products"
              value={sortKey}
              onChange={(value) => updateFilters({ sort: value === "newest" ? null : value })}
            >
              {Object.entries(SORT_OPTIONS).map(([value, option]) => (
                <option key={value} value={value}>{option.label}</option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {hasFilters && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => updateFilters({ [chip.clear]: null })}
                aria-label={`Remove filter ${chip.label}`}
                className="flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/15"
              >
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              onClick={() => router.replace(pathname, { scroll: false })}
              className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
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
          <ProductSkeletons count={8} />
        ) : products.length > 0 ? (
          <div className={`${productGrid} transition-opacity ${loading ? "opacity-60" : ""}`}>
            {productCards.map(({ product, image }) => (
              <ProductCard
                key={product.id}
                product={product}
                imageOverride={image}
                onOpen={setSelectedProduct}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Package className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 font-semibold">No products found</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Try a different search, category, or market.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => router.replace(pathname, { scroll: false })}>
              Clear filters
            </Button>
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
