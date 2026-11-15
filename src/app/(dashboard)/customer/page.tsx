"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, MapPin, ChevronRight, CircleCheck, Circle, UserRound } from "lucide-react";
import Header from "@/components/Header";
import Feed from "@/components/Feed";
import TrendingShopsSection from "@/components/TrendingShopsSection";
import { useAuthStore } from "@/store/authStore";
import { useShops, useLocations, type ProductData } from "@/hooks/useApi";
import { useCartStore } from "@/store/cartStore";
import { cartLineFromProduct } from "@/lib/cart";
import toast from "react-hot-toast";

export default function CustomerDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const addItem = useCartStore((state) => state.addItem);
  const activeTab = "home";
  const { data: shopsData, loading: shopsLoading } = useShops();
  const { data: locationsData } = useLocations();

  const trendingShops = shopsData?.shops || [];
  const allLocations = locationsData?.locations || [];
  const profileChecklist = [
    { label: "First name", complete: Boolean(user?.firstName?.trim()) },
    { label: "Last name", complete: Boolean(user?.lastName?.trim()) },
    { label: "Phone number", complete: Boolean(user?.phone?.trim()) },
    { label: "Location", complete: Boolean(user?.location?.trim()) },
    { label: "Delivery address", complete: Boolean(user?.defaultAddress?.trim()) },
  ];
  const completedProfileItems = profileChecklist.filter((item) => item.complete).length;
  const profileProgress = Math.round((completedProfileItems / profileChecklist.length) * 100);

  const handlePreviewAddToCart = (product: ProductData) => {
    const line = cartLineFromProduct(product);
    if (!line) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem(line);
    toast.success(`${product.name} added to cart`);
  };

  // Redirect authenticated users from landing to dashboard
  useEffect(() => {
    if (user?.id && !window.location.pathname.startsWith("/customer")) {
      router.push("/customer");
    }
  }, [user?.id, router]);

  return (
    <div className="min-h-screen bg-background">
      <Header activeTab={activeTab} userId={user?.id} />
      <main className="p-3 sm:p-4 space-y-4 max-w-2xl mx-auto">
        {user?.authProvider === "google" && profileProgress < 100 && (
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Profile completion">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-brand" />
                <div>
                  <h2 className="text-sm font-bold">Complete your profile</h2>
                  <p className="text-xs text-muted-foreground">Add contact and delivery details for faster checkout.</p>
                </div>
              </div>
              <span className="text-sm font-bold text-brand">{profileProgress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileProgress}>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${profileProgress}%` }} />
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {profileChecklist.map((item) => (
                <li key={item.label} className={`flex items-center gap-1.5 ${item.complete ? "text-emerald-700" : "text-muted-foreground"}`}>
                  {item.complete ? <CircleCheck className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}{item.label}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => router.push("/customer/settings")} className="mt-3 text-xs font-semibold text-brand hover:underline">Complete in profile settings</button>
          </section>
        )}
        <Feed
          afterComposer={(
            <>
              <TrendingShopsSection
                shops={trendingShops}
                loading={shopsLoading}
                onAddToCart={handlePreviewAddToCart}
                onSeeAll={() => router.push("/customer/locations")}
                onOpenShop={(shop) => router.push(`/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}`)}
                onOpenProduct={(shop, product) => router.push(
                  `/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}&productId=${product.id}`
                )}
              />
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-brand" /> Community Feed
              </h2>
            </>
          )}
        />

        {/* ── Quick Locations (with real shop counts) ── */}
        {allLocations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-brand" /> Markets
              </h3>
              <button
                onClick={() => router.push("/customer/locations")}
                className="text-[11px] text-brand flex items-center gap-0.5 hover:underline"
              >
                See all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {allLocations.map((loc) => {
                const shopCount = trendingShops.filter((s) => s.locationId === loc.slug || s.locationId === loc.id).length;
                return (
                  <button
                    key={loc.id}
                    onClick={() => router.push(`/customer/locations/${loc.slug || loc.id}`)}
                    className="shrink-0 px-3 py-2 bg-brand-soft text-brand hover:bg-primary/15 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <MapPin className="h-3 w-3" />
                    {loc.name}
                    <span className="text-[9px] opacity-60">({shopCount})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}