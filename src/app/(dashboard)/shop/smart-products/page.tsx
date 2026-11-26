"use client";

import { useMemo, useState } from "react";
import ShopNav from "@/components/ShopNav";
import Link from "next/link";
import {
  Package,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Tags,
  ArrowRight,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { useProducts, type ProductData } from "@/hooks/useApi";
import { formatKwacha } from "@/lib/product";

type NoticeKind = "restock" | "promote" | "demand";

interface SmartNotice {
  key: string;
  kind: NoticeKind;
  product: ProductData;
  title: string;
  detail: string;
}

const LOW_STOCK = 10;
const SLOW_SELLER_VIEWS = 15;
const HOT_VIEWS = 40;

export default function SmartProductsPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");

  const { data, loading } = useProducts({ shopId: user?.id });
  const products = useMemo(() => data?.products || [], [data]);

  const notices = useMemo<SmartNotice[]>(() => {
    const list: SmartNotice[] = [];

    for (const product of products) {
      if (product.stock === 0) {
        list.push({
          key: `${product.id}-restock`,
          kind: "restock",
          product,
          title: "Out of stock",
          detail: "Customers cannot order this until you add stock.",
        });
      } else if (product.stock <= LOW_STOCK) {
        list.push({
          key: `${product.id}-restock`,
          kind: "restock",
          product,
          title: `Only ${product.stock} left`,
          detail: "Restock soon so the listing stays available.",
        });
      }

      if (product.stock > 0 && product.views >= HOT_VIEWS) {
        list.push({
          key: `${product.id}-demand`,
          kind: "demand",
          product,
          title: `High interest · ${product.views} views`,
          detail: "Getting attention — keep it stocked or feature it in a post.",
        });
      }

      if (product.stock > 0 && product.views < SLOW_SELLER_VIEWS && !product.discount) {
        list.push({
          key: `${product.id}-promote`,
          kind: "promote",
          product,
          title: "Low visibility",
          detail: "Few shoppers have seen this. Try a promotion to boost it.",
        });
      }
    }

    return list;
  }, [products]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => product.name.toLowerCase().includes(term));
  }, [products, search]);

  const counts = {
    restock: notices.filter((notice) => notice.kind === "restock").length,
    promote: notices.filter((notice) => notice.kind === "promote").length,
    demand: notices.filter((notice) => notice.kind === "demand").length,
  };

  const noticeStyles: Record<NoticeKind, { icon: typeof AlertTriangle; chip: string; label: string }> = {
    restock: {
      icon: AlertTriangle,
      chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      label: "Restock",
    },
    promote: {
      icon: Tags,
      chip: "bg-brand/10 text-brand",
      label: "Promote",
    },
    demand: {
      icon: TrendingUp,
      chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      label: "Demand",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <Package className="h-5 w-5 text-brand" /> Smart products
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Stock and promotion suggestions based on your listings
            </p>
          </div>
          <Link
            href="/shop/products"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            All products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(["restock", "promote", "demand"] as NoticeKind[]).map((kind) => {
            const style = noticeStyles[kind];
            return (
              <Card key={kind} className="bg-card border-border">
                <CardContent className="p-3">
                  <div className={`mb-2 inline-flex rounded-lg p-1.5 ${style.chip}`}>
                    <style.icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-bold">{counts[kind]}</p>
                  <p className="text-[10px] text-muted-foreground">{style.label} notices</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : products.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No products yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add products and smart notices will appear here.
            </p>
          </section>
        ) : (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="border-b border-border p-3 sm:p-4">
                  <h2 className="text-sm font-semibold">Notices</h2>
                </div>
                {notices.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Everything looks healthy — no stock or promotion actions needed.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {notices.slice(0, 12).map((notice) => {
                      const style = noticeStyles[notice.kind];
                      return (
                        <div key={notice.key} className="flex items-start gap-3 p-3 sm:p-4">
                          <div className={`shrink-0 rounded-lg p-1.5 ${style.chip}`}>
                            <style.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{notice.product.name}</p>
                              <Badge variant="secondary" className={`text-[10px] ${style.chip}`}>
                                {style.label}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs font-medium">{notice.title}</p>
                            <p className="text-[11px] text-muted-foreground">{notice.detail}</p>
                          </div>
                          <Link
                            href="/shop/products"
                            className="shrink-0 text-[11px] font-medium text-brand hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Products</h2>
                <div className="relative w-full max-w-[14rem]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search products"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((product) => {
                  const stockTone =
                    product.stock === 0
                      ? "text-destructive"
                      : product.stock <= LOW_STOCK
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400";
                  return (
                    <Card key={product.id} className="bg-card border-border">
                      <CardContent className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{product.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatKwacha(product.price)} · {product.views} views
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-xs font-semibold ${stockTone}`}>
                            {product.stock} in stock
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {product.isAvailable ? "Available" : "Hidden"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}