"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { useWishlistStore } from "@/store/wishlistStore";

/**
 * Saved-items shortcut for pages that render their own compact header
 * (locations, shops) so favourites stay reachable where products are browsed.
 */
export default function SavedItemsButton() {
  const mounted = useHydrated();
  const savedCount = useWishlistStore((state) => state.items.length);
  const count = mounted ? savedCount : 0;

  return (
    <Link
      href="/customer/saved"
      aria-label={`Saved items${count ? `, ${count} saved` : ""}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-brand transition-colors hover:bg-muted"
    >
      <Heart className="h-[18px] w-[18px]" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
