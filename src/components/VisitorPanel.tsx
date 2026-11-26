"use client";

import { Eye, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useShopVisitors } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";

interface VisitorPanelProps {
  ownerId: string | null;
}

export default function VisitorPanel({ ownerId }: VisitorPanelProps) {
  const { data, loading, error } = useShopVisitors(ownerId);
  const visitors = data?.views || [];

  return (
    <div className="sm:hidden">
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Eye className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold">Shop visitors</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
              {loading ? "..." : error ? "!" : visitors.length}
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-5 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading visitors
            </div>
          ) : error ? (
            <div className="p-5 text-center text-xs text-destructive">
              Could not load shop visitors
            </div>
          ) : visitors.length === 0 ? (
            <div className="p-5 text-center text-xs text-muted-foreground">
              No signed-in visitors yet
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
              {visitors.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-3 p-3"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={view.visitor.avatar} alt="" />
                    <AvatarFallback className="text-[10px]">
                      {view.visitor.firstName?.[0]}
                      {view.visitor.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {view.visitor.firstName} {view.visitor.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatTimeAgo(view.lastViewedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
