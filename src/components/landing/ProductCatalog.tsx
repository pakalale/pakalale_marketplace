"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Package, SlidersHorizontal, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ProductDetailModal from "@/components/ProductDetailModal";
import Breadcrumbs, { type Crumb } from "@/components/site/Breadcrumbs";
import { useProductFacets, useProducts, type ProductData } from "@/hooks/useApi";
import { SORT_OPTIONS, useCatalogFilters } from "@/hooks/useCatalogFilters";
import { cartLineFromProduct } from "@/lib/cart";
import { productShopName } from "@/lib/product";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import FilterPanel from "./FilterPanel";
import ProductCard from "./ProductCard";

const PAGE_SIZE = 12;

interface ProductCatalogProps {
  /**
   * Limit everything (products, filter counts) to one market, by id or slug.
   * The market picker is then replaced by that market's shops.
   */
  market?: string;
  markets?: Array<{ id: string; name: string }>;
  shops?: Array<{ id: string; name: string }>;
  /** Breadcrumbs before the filter-specific ones, e.g. Markets > Soweto. */
  baseCrumbs?: Crumb[];
  defaultTitle?: string;
  gridClassName?: string;
}

function ProductSkeletons({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
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

/** Filter panel + product grid, with filters kept in the URL. */
export default function ProductCatalog({
  market,
  markets = [],
  shops = [],
  baseCrumbs = [],
  defaultTitle = "Our Products",
  gridClassName = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
}: ProductCatalogProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [selected, setSelected] = useState<ProductData | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const catalog = useCatalogFilters({
    markets: new Map(markets.map((item) => [item.id, item.name])),
    shops: new Map(shops.map((item) => [item.id, item.name])),
  });
  const { filters, search, sortKey, page, chips, params } = catalog;
  const shopId = filters.shop === "all" ? undefined : filters.shop;

  const { data: facets } = useProductFacets(market ? { locationId: market, shopId } : undefined);
  const { data, loading, error, refetch } = useProducts({
    ...catalog.productQuery,
    // A market page stays inside its market; a chosen shop narrows it further.
    ...(market && { locationId: shopId ? undefined : market }),
    limit: PAGE_SIZE,
  });

  const products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // ?product= opens a product straight away (links from the markets overview).
  const linkedId = params.get("product");
  const linked = linkedId ? products.find((product) => product.id === linkedId) : undefined;
  const shown = selected ?? linked ?? null;
  const closeProduct = () => {
    setSelected(null);
    if (linkedId) catalog.setParam("product", null);
  };

  const handleAddToCart = (product: ProductData) => {
    const line = cartLineFromProduct(product);
    if (!line) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem(line);
    toast.success(`${product.name} added to cart`);
  };

  const single = filters.categories.length === 1 ? filters.categories[0] : null;
  const shopName = shopId ? shops.find((item) => item.id === shopId)?.name : null;
  const title = filters.onSale ? "Deals" : single ?? shopName ?? defaultTitle;
  const extra: Crumb[] = single ? [{ label: single }] : filters.onSale ? [{ label: "Deals" }] : search ? [{ label: `Search: ${search}` }] : shopName ? [{ label: shopName }] : [];
  const trail: Crumb[] = [...baseCrumbs, ...extra];
  // The last base crumb is a link only when more crumbs follow it.
  const crumbs = trail.map((crumb, index) => (index === trail.length - 1 ? { label: crumb.label } : crumb));

  const filterPanel = (
    <FilterPanel
      filters={filters}
      facets={facets}
      markets={market ? [] : markets}
      shops={market ? shops : []}
      onChange={catalog.setFilters}
      onClear={catalog.clearAll}
    />
  );

  return (
    <div id="products" className="grid scroll-mt-24 items-start gap-5 md:grid-cols-[14.5rem_minmax(0,1fr)] xl:grid-cols-[15.5rem_minmax(0,1fr)]">
      <div className="hidden md:block">{filterPanel}</div>

      <section aria-label="Products" className="min-w-0">
        {crumbs.length > 0 && <Breadcrumbs items={crumbs} className="mb-2" />}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-brand sm:text-[28px]">{title}</h2>
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
                  onChange={(event) => catalog.setParam("sort", event.target.value === "popular" ? null : event.target.value)}
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
            <button onClick={catalog.clearAll} className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground">
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
          <ProductSkeletons count={6} className={gridClassName} />
        ) : products.length > 0 ? (
          <div className={cn(gridClassName, "transition-opacity", loading && "opacity-60")}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onOpen={setSelected} onAddToCart={handleAddToCart} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Package className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 font-semibold">No products found</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Try a different search or fewer filters.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={catalog.clearAll}>Clear filters</Button>
          </div>
        )}

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => catalog.goToPage(page - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => catalog.goToPage(page + 1)}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </nav>
        )}
      </section>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[88%] max-w-sm overflow-y-auto p-3">
          <SheetTitle className="sr-only">Filters</SheetTitle>
          <div className="pt-8">{filterPanel}</div>
          <Button className="w-full rounded-xl" onClick={() => setFiltersOpen(false)}>
            Show {total.toLocaleString()} {total === 1 ? "product" : "products"}
          </Button>
        </SheetContent>
      </Sheet>

      {shown && (
        <ProductDetailModal
          isOpen
          onClose={closeProduct}
          product={shown}
          shopName={productShopName(shown)}
          primaryActionLabel="Add to Cart"
          onPrimaryAction={(product) => {
            handleAddToCart(product);
            closeProduct();
          }}
        />
      )}
    </div>
  );
}
