"use client";

import { Clock, Eye, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useShopVisitors } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";

interface ShopVisitorsListProps {
  ownerId: string | null;
}

export default function ShopVisitorsList({ ownerId }: ShopVisitorsListProps) {
  const { data, loading, error } = useShopVisitors(ownerId);
  const visitors = data?.views || [];

  return (
    <Card id="shop-visitors" className="bg-card border-border scroll-mt-20">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-border p-3 sm:p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Eye className="h-4 w-4 text-brand" />Shop visitors
          </h2>
          <span className="text-[10px] text-muted-foreground">{visitors.length} unique</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-5 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Loading visitors
          </div>
        ) : error ? (
          <div className="p-5 text-center text-xs text-destructive">Could not load shop visitors</div>
        ) : visitors.length === 0 ? (
          <div className="p-5 text-center text-xs text-muted-foreground">No signed-in visitors yet</div>
        ) : (
          <div className="divide-y divide-border">
            {visitors.map((view) => (
              <div key={view.id} className="flex items-center gap-3 p-3 sm:px-4">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={view.visitor.avatar} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {view.visitor.firstName?.[0]}{view.visitor.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {view.visitor.firstName} {view.visitor.lastName}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />{formatTimeAgo(view.lastViewedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}