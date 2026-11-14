"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, MapPin, Package, Phone, Star, Store } from "lucide-react";
import toast from "react-hot-toast";
import Container from "@/components/landing/Container";
import ProductCard from "@/components/landing/ProductCard";
import ProductDetailModal from "@/components/ProductDetailModal";
import Breadcrumbs from "@/components/site/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation, useProducts, useShops, type ProductData } from "@/hooks/useApi";
import { cartLineFromProduct } from "@/lib/cart";
import { productShopName } from "@/lib/product";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";

const PAGE_SIZE = 12;

function MarketPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const addItem = useCartStore((state) => state.addItem);
  const [selected, setSelected] = useState<ProductData | null>(null);

  // Shop and page live in the URL so Back and shared links keep them.
  const shopId = params.get("shop");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const openProductId = params.get("product");

  const { data: locationData, loading: locationLoading } = useLocation(slug);
  const market = locationData?.location;
  const { data: shopsData } = useShops({ locationId: slug });
  const shops = shopsData?.shops || [];
  const shop = shops.find((item) => item.id === shopId);

  // The products API accepts a market's slug, so this can load alongside the market.
  const { data, loading } = useProducts({
    locationId: shopId ? undefined : slug,
    shopId: shopId || undefined,
    available: true,
    sort: "views",
    order: "desc",
    page,
    limit: PAGE_SIZE,
  });
  const products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const linked = openProductId ? products.find((product) => product.id === openProductId) : null;
  const shown = selected ?? linked ?? null;

  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const addToCart = (product: ProductData) => {
    const line = cartLineFromProduct(product);
    if (!line) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem(line);
    toast.success(`${product.name} added to cart`);
  };

  if (locationLoading && !locationData) {
    return (
      <Container className="max-w-[1440px] space-y-4 py-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </Container>
    );
  }

  if (!market) {
    return (
      <Container className="max-w-xl py-16 text-center">
        <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-bold text-brand">Market not found</h1>
        <Link href="/markets" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground">See all markets</Link>
      </Container>
    );
  }

  return (
    <Container className="max-w-[1440px] py-6 sm:py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "Markets", href: "/markets" },
          shop ? { label: market.name, href: pathname } : { label: market.name },
          ...(shop ? [{ label: shop.name }] : []),
        ]}
      />

      <section className="mb-6 rounded-2xl bg-[#002583] p-5 text-white sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{market.name}</h1>
            {market.description && <p className="mt-1 max-w-2xl text-white/80">{market.description}</p>}
          </div>
          {market.rating > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              <Star className="h-4 w-4 fill-[#ffb800] text-[#ffb800]" /> {market.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/85">
          <span className="flex items-center gap-1.5"><Store className="h-4 w-4" /> {market.shopCount} shops</span>
          <span className="flex items-center gap-1.5"><Package className="h-4 w-4" /> {market.productCount ?? total} products</span>
          {market.hours && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {market.hours}</span>}
          {market.contact && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {market.contact}</span>}
        </div>
      </section>

      {shops.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Shops in this market</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {[{ id: null as string | null, name: "All shops" }, ...shops.map((item) => ({ id: item.id as string | null, name: item.name }))].map((item) => {
              const active = (item.id ?? null) === (shopId ?? null);
              return (
                <button
                  key={item.id ?? "all"}
                  onClick={() => setQuery({ shop: item.id, page: null, product: null })}
                  aria-pressed={active}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    active ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-brand">{shop ? shop.name : "All products"}</h2>
        <p className="text-sm text-muted-foreground">{total} {total === 1 ? "product" : "products"}</p>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-80 rounded-2xl" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No products here yet</p>
          <Link href="/markets" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">See other markets</Link>
        </div>
      ) : (
        <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5", loading && "opacity-60")}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={setSelected} onAddToCart={addToCart} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setQuery({ page: page > 2 ? String(page - 1) : null })}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setQuery({ page: String(page + 1) })}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </nav>
      )}

      {shown && (
        <ProductDetailModal
          isOpen
          onClose={() => {
            setSelected(null);
            if (openProductId) setQuery({ product: null });
          }}
          product={shown}
          shopName={productShopName(shown)}
          primaryActionLabel="Add to Cart"
          onPrimaryAction={(product) => {
            addToCart(product);
            setSelected(null);
            if (openProductId) setQuery({ product: null });
          }}
        />
      )}
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
