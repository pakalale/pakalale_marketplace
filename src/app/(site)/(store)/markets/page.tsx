"use client";

import Link from "next/link";
import { ArrowRight, Clock, MapPin, Package, Star, Store } from "lucide-react";
import Container from "@/components/landing/Container";
import { PageHeading } from "@/components/site/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocations, useProducts, type LocationData } from "@/hooks/useApi";
import { formatKwacha, productImages } from "@/lib/product";
import { productPlaceholder } from "@/lib/placeholders";

function marketHref(market: LocationData) {
  return `/markets/${market.slug || market.id}`;
}

/** A market and a peek at what its shops sell. */
function MarketCard({ market }: { market: LocationData }) {
  const { data, loading } = useProducts({ locationId: market.id, available: true, sort: "views", order: "desc", limit: 4 });
  const products = data?.products || [];
  const total = data?.total ?? market.productCount ?? 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(0,37,131,0.05)]">
      <div className="bg-[#002583] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{market.name}</h2>
          {market.rating > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
              <Star className="h-3.5 w-3.5 fill-[#ffb800] text-[#ffb800]" /> {market.rating.toFixed(1)}
            </span>
          )}
        </div>
        {market.description && <p className="mt-1 line-clamp-2 text-sm text-white/80">{market.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/85">
          <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> {market.shopCount} {market.shopCount === 1 ? "shop" : "shops"}</span>
          <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {total} {total === 1 ? "product" : "products"}</span>
          {market.hours && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {market.hours}</span>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {market.specialties?.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {market.specialties.slice(0, 5).map((item) => (
              <span key={item} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand dark:bg-muted">{item}</span>
            ))}
          </div>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((key) => <Skeleton key={key} className="aspect-square rounded-xl" />)}</div>
        ) : products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No products listed yet.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {products.map((product) => (
              <li key={product.id}>
                <Link href={`${marketHref(market)}?product=${product.id}`} className="group block">
                  <span className="block aspect-square overflow-hidden rounded-xl bg-[#f4f6fb] dark:bg-muted">
                    <img
                      src={productImages(product)[0] || productPlaceholder(product.category, product.id)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </span>
                  <span className="mt-1 block truncate text-xs font-medium">{product.name}</span>
                  <span className="block text-xs font-bold text-brand">{formatKwacha(product.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={marketHref(market)}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
        >
          Visit {market.name} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export default function MarketsPage() {
  const { data, loading, error, refetch } = useLocations();
  const markets = data?.locations || [];

  return (
    <Container className="max-w-[1440px] py-6 sm:py-8">
      <PageHeading crumbs={[{ label: "Markets" }]} title="Markets">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> Shop by the market you know</p>
      </PageHeading>

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => <Skeleton key={key} className="h-96 rounded-2xl" />)}
        </div>
      ) : error && !data ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">We could not load the markets</p>
          <button onClick={refetch} className="mt-2 text-sm font-semibold text-brand hover:underline">Try again</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {markets.map((market) => <MarketCard key={market.id} market={market} />)}
        </div>
      )}
    </Container>
  );
}
