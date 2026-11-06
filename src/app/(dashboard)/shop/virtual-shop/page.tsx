"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShopNav from "@/components/ShopNav";
import { Store, Star, MapPin, Phone, Mail, Settings as SettingsIcon, Search, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/authStore";
import { useShop, useProducts } from "@/hooks/useApi";

export default function VirtualShopPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: shopData, loading: shopLoading } = useShop(user?.id || null);
  const { data: productsData, loading: productsLoading } = useProducts({
    shopId: user?.id || undefined,
    search: searchQuery || undefined,
    category: selectedCategory !== "all" ? selectedCategory : undefined,
  });

  const shop = shopData?.shop;
  const products = productsData?.products || [];
  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category)))];

  const hours = shop?.hours || {};

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="px-4 py-4 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">My Shop</h1>
            <p className="text-xs text-muted-foreground">Preview your virtual storefront</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push("/shop/settings")}>
            <SettingsIcon className="h-4 w-4 mr-1" />Edit
          </Button>
        </div>

        {shopLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : shop ? (
          <>
            {/* Shop Info */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-amber-golden/10 p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 border-2 border-background">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-amber-golden text-primary-foreground text-lg sm:text-xl">
                        {shop.name?.charAt(0) || "S"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold truncate">{shop.name}</h2>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />{shop.rating || "—"} ({shop.totalReviews})</span>
                        <span className="flex items-center gap-1"><Store className="h-3 w-3" />{products.length} products</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <h3 className="text-sm font-semibold mb-1">About</h3>
                    <p className="text-xs text-muted-foreground mb-2">{shop.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {shop.specialties?.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" />{shop.locationId || "Lusaka"}</div>
                    {shop.contact?.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" />{shop.contact.phone}</div>}
                    {shop.contact?.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" />{shop.contact.email}</div>}
                    {Object.keys(hours).length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-foreground text-xs mb-1">Hours</p>
                        {Object.entries(hours).map(([day, h]) => {
                          const hr = h as { open: string; close: string; closed: boolean };
                          return (
                            <p key={day} className="capitalize">
                              {day}: {hr.closed ? "Closed" : `${hr.open} - ${hr.close}`}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Products ({products.length})</h2>
                <Button size="sm" variant="ghost" className="text-primary" onClick={() => router.push("/shop/products")}>Manage</Button>
              </div>

              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-2 py-1 bg-muted border border-border rounded-md text-xs">
                  {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All" : c}</option>)}
                </select>
              </div>

              {productsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {products.map((product) => (
                    <Card key={product.id} className="bg-card border-border hover:border-primary/20 transition-colors">
                      <CardContent className="p-3">
                        <h3 className="font-medium text-xs truncate mb-1">{product.name}</h3>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm font-bold">K{product.price.toLocaleString()}</span>
                          {product.originalPrice && <span className="text-[9px] text-muted-foreground line-through">K{product.originalPrice.toLocaleString()}</span>}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />{product.rating}</div>
                          <span>{product.stock} in stock</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Shop not found</p>
            <p className="text-xs">Set up your shop to get started</p>
          </div>
        )}
      </main>
    </div>
  );
}
