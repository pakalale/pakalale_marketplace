"use client";

import { useEffect, useState } from "react";
import ShopNav from "@/components/ShopNav";
import Feed from "@/components/Feed";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Store, TrendingUp } from "lucide-react";

export default function ShopFeedPage() {
  const { user } = useAuthStore();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const key = `shopWelcomeShown:${user.id}`;
    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      setShowWelcome(true);
      hideTimer = window.setTimeout(() => setShowWelcome(false), 5000);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="p-3 sm:p-4 space-y-4 max-w-2xl mx-auto">
        {showWelcome && <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-amber-golden/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-brand shrink-0" />
              <div>
                <h2 className="text-lg font-bold">Hey, {user?.firstName} 👋</h2>
                <p className="text-xs text-muted-foreground">What&apos;s happening in your community</p>
              </div>
            </div>
          </CardContent>
        </Card>}

        {/* Community Feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-brand" />
              Community Feed
            </h3>
          </div>
          <Feed />
        </div>
      </main>
    </div>
  );
}
