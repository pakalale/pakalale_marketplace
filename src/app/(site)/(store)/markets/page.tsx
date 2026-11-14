"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import Container from "@/components/landing/Container";
import ProductCard from "@/components/landing/ProductCard";
import ProductDetailModal from "@/components/ProductDetailModal";
import { PageHeading } from "@/components/site/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocations, useProducts, type LocationData, type ProductData } from "@/hooks/useApi";
import { cartLineFromProduct } from "@/lib/cart";
import { productShopName } from "@/lib/product";
import { useCartStore } from "@/store/cartStore";

const ROW_LIMIT = 12;
const cardWidth = "w-[11.5rem] shrink-0 snap-start sm:w-[13.5rem]";

/** One market: its name (the way in) and a scrollable row of its products. */
function MarketRow({ market, onOpen, onAddToCart }: {
  market: LocationData;
  onOpen: (product: ProductData) => void;
  onAddToCart: (product: ProductData) => void;
}) {
  const href = `/markets/${market.slug || market.id}`;
  const scroller = useRef<HTMLDivElement>(null);
  const { data, loading } = useProducts({ locationId: market.id, available: true, sort: "views", order: "desc", limit: ROW_LIMIT });
  const products = data?.products || [];
  const total = data?.total ?? market.productCount ?? 0;

  const scroll = (direction: 1 | -1) => {
    const element = scroller.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: "smooth" });
  };
  const arrow = "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-brand shadow-md transition-colors hover:bg-muted md:flex";

  return (
    <section aria-labelledby={`market-${market.id}`} className="py-6 first:pt-2">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href={href} className="group inline-flex items-center gap-1">
            <h2 id={`market-${market.id}`} className="truncate text-xl font-bold text-brand group-hover:underline sm:text-2xl">{market.name}</h2>
            <ChevronRight className="h-5 w-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {market.shopCount} {market.shopCount === 1 ? "shop" : "shops"} · {total} {total === 1 ? "product" : "products"}
            {market.hours && <span className="hidden sm:inline"> · {market.hours}</span>}
          </p>
        </div>
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading && !data ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} className={`${cardWidth} h-80 rounded-2xl`} />)}
        </div>
      ) : products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No products listed in this market yet.
        </p>
      ) : (
        <div className="relative">
          <button type="button" onClick={() => scroll(-1)} aria-label={`Scroll ${market.name} left`} className={`${arrow} -left-4`}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div ref={scroller} className="-mx-1 flex snap-x gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none] sm:gap-4">
            {products.map((product) => (
              <div key={product.id} className={cardWidth}>
                <ProductCard product={product} onOpen={onOpen} onAddToCart={onAddToCart} />
              </div>
            ))}
            {total > products.length && (
              <Link
                href={href}
                className={`${cardWidth} flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand/30 bg-card text-center font-semibold text-brand hover:bg-brand/5`}
              >
                <ArrowRight className="h-6 w-6" />
                See all {total} products
              </Link>
            )}
          </div>
          <button type="button" onClick={() => scroll(1)} aria-label={`Scroll ${market.name} right`} className={`${arrow} -right-4`}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </section>
  );
}

export default function MarketsPage() {
  const { data, loading, error, refetch } = useLocations();
  const markets = data?.locations || [];
  const addItem = useCartStore((state) => state.addItem);
  const [selected, setSelected] = useState<ProductData | null>(null);

  const addToCart = (product: ProductData) => {
    const line = cartLineFromProduct(product);
    if (!line) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem(line);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Container className="max-w-[1440px] py-6 sm:py-8">
      <PageHeading crumbs={[{ label: "Markets" }]} title="Markets">
        <p className="text-sm text-muted-foreground">Tap a market to see everything it sells.</p>
      </PageHeading>

      {loading && !data ? (
        <div className="space-y-8">{[0, 1].map((key) => <Skeleton key={key} className="h-96 w-full rounded-2xl" />)}</div>
      ) : error && !data ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">We could not load the markets</p>
          <button onClick={refetch} className="mt-2 text-sm font-semibold text-brand hover:underline">Try again</button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {markets.map((market) => (
            <MarketRow key={market.id} market={market} onOpen={setSelected} onAddToCart={addToCart} />
          ))}
        </div>
      )}

      {selected && (
        <ProductDetailModal
          isOpen
          onClose={() => setSelected(null)}
          product={selected}
          shopName={productShopName(selected)}
          primaryActionLabel="Add to Cart"
          onPrimaryAction={(product) => {
            addToCart(product);
            setSelected(null);
          }}
        />
      )}
    </Container>
  );
}
