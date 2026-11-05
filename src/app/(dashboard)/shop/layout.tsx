"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Loader2 } from "lucide-react";
import ShopBottomNav from "@/components/ShopBottomNav";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, hasCheckedSession } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (hasCheckedSession && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hasCheckedSession, isAuthenticated, router]);

  // Wait for session check
  if (!hasCheckedSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  // Role-based protection: only shop_owner can access shop pages
  if (user.role !== "shop_owner" && user.role !== "admin") {
    router.replace(user.role === "customer" ? "/customer" : "/login");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 sm:pb-0">
        {children}
      </main>
      <ShopBottomNav />
    </div>
  );
}
