"use client";

import { useEffect, useRef } from "react";
import { useNotificationStore } from "@/store/notificationStore";

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Polls for chat unread count and notification count.
 * Returns nothing — updates zustand stores directly so all components react.
 */
export function useCountPolling(userId?: string) {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCounts = async () => {
    if (!userId) return;
    try {
      const notifRes = await fetch(`/api/notifications?userId=${userId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (notifRes?.unreadCount !== undefined) {
        setUnreadCount(notifRes.unreadCount);
      }
    } catch {
      // Silently fail — will retry on next interval
    }
  };

  // Also expose a way to get chat unread count for components that need it locally
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchCounts();

    // Poll every 30s
    intervalRef.current = setInterval(fetchCounts, POLL_INTERVAL);

    // Also refetch on visibility change (user comes back to tab)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchCounts();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId, setUnreadCount]);
}
