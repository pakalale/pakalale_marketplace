"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterState } from "@/components/landing/FilterPanel";
import { categoryFilter } from "@/lib/storeCategories";

export const SORT_OPTIONS = {
  popular: { label: "Most Popular", sort: "views", order: "desc" },
  newest: { label: "Newest", sort: "createdAt", order: "desc" },
  rating: { label: "Top Rated", sort: "rating", order: "desc" },
  "price-low": { label: "Price: Low to High", sort: "price", order: "asc" },
  "price-high": { label: "Price: High to Low", sort: "price", order: "desc" },
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

function numberParam(value: string | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/**
 * Product filters kept in the URL, so links, refresh and Back all keep them.
 * Shared by the home page and each market page. `names` turns market and shop
 * ids into readable chip labels.
 */
export function useCatalogFilters(names: { markets?: Map<string, string>; shops?: Map<string, string> } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const search = params.get("q") || "";
  const filters: FilterState = {
    categories: params.getAll("category").filter((value) => value && value !== "all"),
    brands: params.getAll("brand").filter(Boolean),
    market: params.get("market") || "all",
    shop: params.get("shop") || "all",
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
    (["categories", "brands"] as const).forEach((key) => {
      if (!(key in patch)) return;
      const name = key === "categories" ? "category" : "brand";
      next.delete(name);
      patch[key]!.forEach((value) => next.append(name, value));
    });
    (["market", "shop"] as const).forEach((key) => {
      if (!(key in patch)) return;
      const value = patch[key];
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    });
    ([["inStock", "stock"], ["onSale", "sale"]] as const).forEach(([key, name]) => {
      if (!(key in patch)) return;
      if (patch[key]) next.set(name, "1");
      else next.delete(name);
    });
    (["min", "max"] as const).forEach((key) => {
      if (!(key in patch)) return;
      const value = patch[key];
      if (value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
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

  /** Drops every filter but keeps the chosen sort order. */
  const clearAll = () => {
    const next = new URLSearchParams();
    if (params.get("sort")) next.set("sort", params.get("sort")!);
    replaceQuery(next);
  };

  const goToPage = (nextPage: number, scrollTo = "products") => {
    const next = new URLSearchParams(params.toString());
    if (nextPage > 1) next.set("page", String(nextPage));
    else next.delete("page");
    replaceQuery(next);
    document.getElementById(scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    chips.push({ label: names.markets?.get(filters.market) || "Market", remove: () => setFilters({ market: "all" }) });
  }
  if (filters.shop !== "all") {
    chips.push({ label: names.shops?.get(filters.shop) || "Shop", remove: () => setFilters({ shop: "all" }) });
  }
  if (filters.min !== null || filters.max !== null) {
    chips.push({ label: `K${filters.min ?? 0} – ${filters.max !== null ? `K${filters.max}` : "any"}`, remove: () => setFilters({ min: null, max: null }) });
  }
  if (filters.inStock) chips.push({ label: "In stock", remove: () => setFilters({ inStock: false }) });
  if (filters.onSale) chips.push({ label: "On sale", remove: () => setFilters({ onSale: false }) });

  /** Arguments for useProducts that match the current filters. */
  const productQuery = {
    category: filters.categories.length
      ? [...new Set(filters.categories.flatMap((value) => [categoryFilter(value)].flat()))]
      : undefined,
    search: search || undefined,
    locationId: filters.market === "all" ? undefined : filters.market,
    shopId: filters.shop === "all" ? undefined : filters.shop,
    onSale: filters.onSale,
    inStock: filters.inStock,
    brands: filters.brands,
    minPrice: filters.min ?? undefined,
    maxPrice: filters.max ?? undefined,
    sort: SORT_OPTIONS[sortKey].sort,
    order: SORT_OPTIONS[sortKey].order as "asc" | "desc",
    page,
    available: true,
  };

  return { params, search, filters, sortKey, page, setFilters, setParam, clearAll, goToPage, chips, productQuery };
}
