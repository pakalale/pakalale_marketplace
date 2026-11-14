"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock, MapPin, Package, Phone, Star, Store } from "lucide-react";
import Container from "@/components/landing/Container";
import ProductCatalog from "@/components/landing/ProductCatalog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation, useShops } from "@/hooks/useApi";

/** One market: its details, then only its products, with filters scoped to it. */
function MarketPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, loading } = useLocation(slug);
  const market = data?.location;
  const { data: shopsData } = useShops({ locationId: slug });
  const shops = (shopsData?.shops || []).map((shop) => ({ id: shop.id, name: shop.name }));

  if (loading && !data) {
    return (
      <Container className="max-w-[1440px] space-y-4 py-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </Container>
    );
  }

  if (!market) {
    return (
      <Container className="max-w-xl py-16 text-center">
        <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-bold text-brand">Market not found</h1>
        <Link href="/markets" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground">
          See all markets
        </Link>
      </Container>
    );
  }

  return (
    <Container className="max-w-[1440px] py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand">{market.name}</h1>
          {market.description && <p className="mt-1 max-w-2xl text-muted-foreground">{market.description}</p>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {market.rating > 0 && <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-primary text-primary" /> {market.rating.toFixed(1)}</span>}
          <span className="flex items-center gap-1"><Store className="h-4 w-4" /> {market.shopCount} shops</span>
          {market.productCount !== undefined && <span className="flex items-center gap-1"><Package className="h-4 w-4" /> {market.productCount} products</span>}
          {market.hours && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {market.hours}</span>}
          {market.contact && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {market.contact}</span>}
        </div>
      </header>

      <ProductCatalog
        market={slug}
        shops={shops}
        baseCrumbs={[{ label: "Markets", href: "/markets" }, { label: market.name, href: `/markets/${slug}` }]}
        defaultTitle="All products"
        gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      />
    </Container>
  );
}

export default function MarketDetailPage() {
  return (
    <Suspense>
      <MarketPage />
    </Suspense>
  );
}
