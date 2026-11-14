"use client";

import { useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import type { ProductFacets } from "@/hooks/useApi";
import { formatKwacha } from "@/lib/product";
import { STORE_CATEGORIES } from "@/lib/storeCategories";
import { cn } from "@/lib/utils";

export interface FilterState {
  categories: string[];
  brands: string[];
  market: string;
  shop: string;
  inStock: boolean;
  onSale: boolean;
  min: number | null;
  max: number | null;
}

interface FilterPanelProps {
  filters: FilterState;
  facets: ProductFacets | null;
  markets: Array<{ id: string; name: string }>;
  /** On a market page: that market's shops, instead of the market picker. */
  shops?: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
  className?: string;
}

const LIST_LIMIT = 5;

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[15px] font-bold text-brand">{children}</h3>;
}

function Check({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 rounded accent-[var(--brand)]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="shrink-0 text-xs text-muted-foreground">({count})</span>}
    </label>
  );
}

function ShowMore({ open, onToggle, hidden }: { open: boolean; onToggle: () => void; hidden: number }) {
  if (hidden <= 0) return null;
  return (
    <button type="button" onClick={onToggle} className="mt-1 flex items-center gap-1 text-sm font-medium text-brand hover:underline">
      {open ? "Show less" : `Show more (${hidden})`}
      <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
    </button>
  );
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Two thumbs on one track. Applies when a thumb is released, not on every pixel. */
function PriceRange({ bounds, min, max, onCommit }: {
  bounds: { min: number; max: number };
  min: number | null;
  max: number | null;
  onCommit: (min: number | null, max: number | null) => void;
}) {
  const committed = `${min ?? bounds.min}-${max ?? bounds.max}`;
  const [draft, setDraft] = useState({ key: committed, low: min ?? bounds.min, high: max ?? bounds.max });
  // Follow outside changes (e.g. "Clear all") without an effect.
  const view = draft.key === committed ? draft : { key: committed, low: min ?? bounds.min, high: max ?? bounds.max };
  const span = Math.max(1, bounds.max - bounds.min);
  const step = span > 2000 ? 50 : span > 200 ? 10 : 1;
  const pct = (value: number) => ((value - bounds.min) / span) * 100;

  const commit = () => {
    onCommit(view.low <= bounds.min ? null : view.low, view.high >= bounds.max ? null : view.high);
  };
  const thumb =
    "pointer-events-none absolute inset-x-0 top-0 h-5 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow";

  return (
    <div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-2 h-1.5 rounded-full bg-muted" />
        <div className="absolute top-2 h-1.5 rounded-full bg-primary" style={{ left: `${pct(view.low)}%`, right: `${100 - pct(view.high)}%` }} />
        <input
          type="range"
          aria-label="Minimum price"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={view.low}
          onChange={(event) => setDraft({ ...view, low: Math.min(Number(event.target.value), view.high) })}
          onPointerUp={commit}
          onKeyUp={commit}
          className={thumb}
        />
        <input
          type="range"
          aria-label="Maximum price"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={view.high}
          onChange={(event) => setDraft({ ...view, high: Math.max(Number(event.target.value), view.low) })}
          onPointerUp={commit}
          onKeyUp={commit}
          className={thumb}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm font-medium">
        <span>{formatKwacha(view.low)}</span>
        <span>{formatKwacha(view.high)}</span>
      </div>
    </div>
  );
}

/** "Filter Products" panel: categories, price, brand, market and availability. */
export default function FilterPanel({ filters, facets, markets, shops = [], onChange, onClear, className }: FilterPanelProps) {
  const [moreCategories, setMoreCategories] = useState(false);
  const [moreBrands, setMoreBrands] = useState(false);

  const counts = new Map((facets?.categories || []).map((item) => [item.name, item.count]));
  const covered = new Set(STORE_CATEGORIES.flatMap((group) => group.categories));
  const categoryRows = [
    ...STORE_CATEGORIES.map((group) => ({
      value: group.label,
      count: group.categories.reduce((sum, name) => sum + (counts.get(name) || 0), 0),
    })),
    ...(facets?.categories || [])
      .filter((item) => !covered.has(item.name))
      .sort((a, b) => b.count - a.count)
      .map((item) => ({ value: item.name, count: item.count })),
  ].filter((row) => row.count > 0 || filters.categories.includes(row.value));
  // A category picked from a link (e.g. "Mobile Phones") may sit inside a
  // department row; list it too, so it can be unticked.
  filters.categories
    .filter((value) => !categoryRows.some((row) => row.value === value))
    .forEach((value) => categoryRows.unshift({ value, count: counts.get(value) || 0 }));
  const visibleCategories = moreCategories ? categoryRows : categoryRows.slice(0, LIST_LIMIT);

  const brandRows = facets?.brands || [];
  const visibleBrands = moreBrands ? brandRows : brandRows.slice(0, 4);
  const priceBounds = facets && facets.price.max > facets.price.min ? facets.price : null;
  const active =
    filters.categories.length + filters.brands.length > 0 ||
    filters.market !== "all" || filters.shop !== "all" || filters.inStock || filters.onSale || filters.min !== null || filters.max !== null;

  return (
    <div className={cn("space-y-5 rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-brand">
          <Filter className="h-5 w-5" /> Filter Products
        </h2>
        {active && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        )}
      </div>

      <section>
        <Heading>Categories</Heading>
        {visibleCategories.map((row) => (
          <Check
            key={row.value}
            label={row.value}
            count={row.count}
            checked={filters.categories.includes(row.value)}
            onChange={() => onChange({ categories: toggle(filters.categories, row.value) })}
          />
        ))}
        <ShowMore open={moreCategories} onToggle={() => setMoreCategories(!moreCategories)} hidden={categoryRows.length - LIST_LIMIT} />
      </section>

      {priceBounds && (
        <section>
          <Heading>Price Range</Heading>
          <PriceRange bounds={priceBounds} min={filters.min} max={filters.max} onCommit={(min, max) => onChange({ min, max })} />
        </section>
      )}

      {brandRows.length > 0 && (
        <section>
          <Heading>Brand</Heading>
          {visibleBrands.map((brand) => (
            <Check
              key={brand.name}
              label={brand.name}
              count={brand.count}
              checked={filters.brands.includes(brand.name)}
              onChange={() => onChange({ brands: toggle(filters.brands, brand.name) })}
            />
          ))}
          <ShowMore open={moreBrands} onToggle={() => setMoreBrands(!moreBrands)} hidden={brandRows.length - 4} />
        </section>
      )}

      {markets.length > 0 && (
        <section>
          <Heading>Market</Heading>
          <div className="relative">
            <select
              value={filters.market}
              aria-label="Filter by market"
              onChange={(event) => onChange({ market: event.target.value })}
              className="h-10 w-full appearance-none rounded-xl border border-border bg-card pl-3 pr-9 text-sm outline-none focus:border-brand/40"
            >
              <option value="all">All markets</option>
              {markets.map((market) => (
                <option key={market.id} value={market.id}>{market.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </section>
      )}

      {shops.length > 0 && (
        <section>
          <Heading>Shop</Heading>
          <div className="relative">
            <select
              value={filters.shop}
              aria-label="Filter by shop"
              onChange={(event) => onChange({ shop: event.target.value })}
              className="h-10 w-full appearance-none rounded-xl border border-border bg-card pl-3 pr-9 text-sm outline-none focus:border-brand/40"
            >
              <option value="all">All shops</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </section>
      )}

      <section>
        <Heading>Availability</Heading>
        <Check label="In Stock" count={facets?.inStock} checked={filters.inStock} onChange={() => onChange({ inStock: !filters.inStock })} />
        <Check label="On Sale" count={facets?.onSale} checked={filters.onSale} onChange={() => onChange({ onSale: !filters.onSale })} />
      </section>
    </div>
  );
}
