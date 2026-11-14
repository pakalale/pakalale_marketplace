"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { loginHref } from "@/lib/authRedirect";
import { useGlobalSocket } from "@/hooks/useGlobalSocket";
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
      // Come back to this page after signing in.
      router.replace(loginHref(pathname));
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

  // Customer pages live in the (site) group; this layout serves the seller area.
  const isShop = pathname.startsWith("/shop");

  if (isShop && user.role !== "shop_owner" && user.role !== "admin") {
    router.replace("/customer");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main>{children}</main>
    </div>
  );
}
