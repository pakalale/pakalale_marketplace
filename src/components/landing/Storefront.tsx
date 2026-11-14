"use client";

import Link from "next/link";
import { ArrowRight, Headphones, RotateCcw, ShieldCheck, Tag, Truck } from "lucide-react";
import CartPanel from "@/components/cart/CartPanel";
import { useLocations } from "@/hooks/useApi";
import Container from "./Container";
import Hero from "./Hero";
import ProductCatalog from "./ProductCatalog";

const TRUST_ITEMS = [
  { icon: Truck, title: "Fast Delivery", detail: "Across Zambia" },
  { icon: ShieldCheck, title: "Secure Payments", detail: "Cash on delivery or pickup" },
  { icon: RotateCcw, title: "Easy Returns", detail: "Agree returns with the shop" },
  { icon: Headphones, title: "Customer Support", detail: "Chat with shops directly" },
];

/** The home page: hero, filterable products and the live cart. */
export default function Storefront() {
  const { data: locationData } = useLocations();
  const markets = (locationData?.locations || []).map((location) => ({ id: location.id, name: location.name }));

  return (
    <Container className="max-w-[1440px] pb-10 pt-4 sm:pb-14 sm:pt-5">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Hero />
          <ProductCatalog markets={markets} />
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

    </Container>
  );
}
