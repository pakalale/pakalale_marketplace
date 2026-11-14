"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginHref } from "@/lib/authRedirect";
import { useAuthStore } from "@/store/authStore";

/**
 * When an API answers "please sign in", send the person to sign-in and back.
 * Covers a session that ended while the browser still looked signed in, and a
 * signed-out visitor pressing a button that needs an account.
 */
export default function SessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const originalFetch = window.fetch;
    let redirecting = false;

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      if (response.status !== 401 || redirecting) return response;

      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(raw, window.location.origin);
      const isOwnApi = url.origin === window.location.origin && url.pathname.startsWith("/api/");
      // Wrong passwords and session probes are handled by the auth pages themselves.
      if (!isOwnApi || url.pathname.startsWith("/api/auth/") || window.location.pathname === "/login") {
        return response;
      }

      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const { user, logout } = useAuthStore.getState();
      // Background reads by guests are expected to fail quietly.
      if (!user && method === "GET") return response;

      redirecting = true;
      if (user) logout();
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`${loginHref(here)}${user ? "&expired=1" : ""}`);
      window.setTimeout(() => {
        redirecting = false;
      }, 3000);
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  return null;
}
