"use client";

import Link from "next/link";
import { Eye, ArrowLeft, Loader2 } from "lucide-react";
import ShopNav from "@/components/ShopNav";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import { useShopVisitors } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ShopVisitorsPage() {
  const { user } = useAuthStore();
  const { data, loading } = useShopVisitors(user?.id || null);
  const visitors = data?.views || [];

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/shop/overview"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to My Shop
            </Link>
            <h1 className="mt-2 flex items-center gap-2 text-lg font-bold">
              <Eye className="h-5 w-5 text-brand" />
              Shop visitors
            </h1>
            <p className="text-xs text-muted-foreground">
              People who viewed your storefront
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {visitors.length} unique{" "}
            {visitors.length === 1 ? "visitor" : "visitors"}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : visitors.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No signed-in visitors yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Visitors appear here when they view your storefront while
                signed in.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {visitors.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-3 p-3 sm:px-4"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={view.visitor.avatar} alt="" />
                      <AvatarFallback className="text-sm">
                        {view.visitor.firstName?.[0]}
                        {view.visitor.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {view.visitor.firstName} {view.visitor.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last viewed{" "}
                        {formatTimeAgo(view.lastViewedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
