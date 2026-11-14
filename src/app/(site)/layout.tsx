"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Footer from "@/components/landing/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import { rememberSitePage } from "@/lib/authRedirect";
import { useAuthStore } from "@/store/authStore";

/**
 * Every customer-facing page (store and account) shares this frame, so
 * the header, its links and the footer never disappear.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const validateSession = useAuthStore((state) => state.validateSession);
  const checked = useRef(false);
  const pathname = usePathname();

  // Sign-in pages live outside this layout; their Back button returns here.
  useEffect(() => {
    rememberSitePage(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  // Confirm a saved login with the server once per visit. An expired one is
  // cleared here, so the header never shows a stale account.
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    validateSession();
  }, [validateSession]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
