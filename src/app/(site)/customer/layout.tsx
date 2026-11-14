"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useGlobalSocket } from "@/hooks/useGlobalSocket";
import { loginHref } from "@/lib/authRedirect";
import { accountHome } from "@/lib/siteNav";
import { useAuthStore } from "@/store/authStore";

function Loading() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-7 w-7 animate-spin text-brand" />
    </div>
  );
}

/** Customer-only pages. The site header stays; only this area waits for the session. */
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, hasCheckedSession } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  // Live chat and unread counts.
  useGlobalSocket(user?.id);

  const redirect = !hasCheckedSession
    ? null
    : !isAuthenticated || !user
      ? loginHref(pathname)
      : user.role !== "customer"
        ? accountHome(user.role).href
        : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (!hasCheckedSession || redirect) return <Loading />;
  return <>{children}</>;
}
