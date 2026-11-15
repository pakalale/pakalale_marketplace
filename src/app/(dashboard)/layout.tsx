"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useGlobalSocket } from "@/hooks/useGlobalSocket";
import BottomNav from "@/components/BottomNav";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, hasCheckedSession, validateSession } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const hasRunValidation = useRef(false);

  // Global socket for real-time counts — must be called before any early returns
  useGlobalSocket(user?.id);

  // Validate session once on first mount
  useEffect(() => {
    if (!hasRunValidation.current) {
      hasRunValidation.current = true;
      validateSession();
    }
  }, [validateSession]);

  // Redirect to login if not authenticated after session check
  useEffect(() => {
    if (hasCheckedSession && !isAuthenticated) {
      // Store the intended destination for redirect back after login
      sessionStorage.setItem("redirectAfterLogin", pathname);
      router.replace("/login");
    }
  }, [hasCheckedSession, isAuthenticated, pathname, router]);

  // Show loading while checking session
  if (!hasCheckedSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  const isCustomer = pathname.startsWith("/customer");
  const isShop = pathname.startsWith("/shop");
  const isAdmin = pathname.startsWith("/admin");

  // Admin routes are handled by (admin) layout — skip dashboard layout rendering
  if (isAdmin) {
    return <>{children}</>;
  }

  // Role-based route protection
  if (isCustomer && user.role === "shop_owner") {
    router.replace("/shop/feed");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (isShop && user.role === "customer") {
    router.replace("/customer");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className={isCustomer ? "pb-16 sm:pb-0" : ""}>
        {children}
      </main>
      {isCustomer && <BottomNav />}
    </div>
  );
}
