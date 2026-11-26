"use client";

import { useState } from "react";
import { Eye, ChevronDown, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useShopVisitors } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";

interface VisitorDropdownCardProps {
  ownerId: string | null;
}

export default function VisitorDropdownCard({
  ownerId,
}: VisitorDropdownCardProps) {
  const { data, loading, error } = useShopVisitors(ownerId);
  const visitors = data?.views || [];
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-full w-full items-center gap-2 sm:gap-2.5 rounded-lg border border-border bg-card p-2 sm:p-2.5 transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <div className="shrink-0 rounded-lg bg-blue-400/10 p-1 sm:p-1.5">
          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm sm:text-base font-bold leading-tight">
            {loading
              ? "—"
              : error
              ? "—"
              : visitors.length === 0
              ? "—"
              : visitors.length.toLocaleString()}
          </p>
          <p className="truncate text-[9px] sm:text-[10px] text-muted-foreground">
            {loading
              ? "Loading visitors"
              : error
              ? "Error"
              : visitors.length === 0
              ? "No visitors"
              : `${visitors.length} ${visitors.length === 1 ? "visitor" : "visitors"}`}
          </p>
        </div>
        <ChevronDown
          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          <div className="divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading visitors
              </div>
            ) : error ? (
              <div className="p-4 text-center text-xs text-destructive">
                Could not load shop visitors
              </div>
            ) : visitors.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No signed-in visitors yet
              </div>
            ) : (
              visitors.slice(0, 4).map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-3 p-3"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={view.visitor.avatar} alt="" />
                    <AvatarFallback className="text-[9px]">
                      {view.visitor.firstName?.[0]}
                      {view.visitor.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {view.visitor.firstName} {view.visitor.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatTimeAgo(view.lastViewedAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
            {visitors.length > 4 && (
              <div className="border-t border-border p-2 text-center">
                <a
                  href="/shop/visitors"
                  className="text-[11px] font-medium text-brand hover:underline"
                >
                  View all {visitors.length} visitors
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
