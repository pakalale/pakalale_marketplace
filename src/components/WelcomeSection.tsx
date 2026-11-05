"use client";

import { Store, TrendingUp, Users, MapPin, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { useShops, useLocations } from "@/hooks/useApi";

export default function WelcomeSection() {
  const { user } = useAuthStore();
  const { data: shopsData, loading: shopsLoading } = useShops();
  const { data: locationsData, loading: locLoading } = useLocations();

  const shopCount = shopsData?.shops?.length ?? 0;
  const locationCount = locationsData?.locations?.length ?? 0;

  const stats = [
    { icon: Store, value: shopsLoading ? "..." : `${shopCount}`, label: "Shops", color: "text-teal-500", bg: "bg-teal-500/10" },
    { icon: MapPin, value: locLoading ? "..." : `${locationCount}`, label: "Locations", color: "text-amber-400", bg: "bg-amber-400/10" },
    { icon: Users, value: "—", label: "Users", color: "text-brand", bg: "bg-primary/10" },
    { icon: TrendingUp, value: "—", label: "Active", color: "text-rose-400", bg: "bg-rose-400/10" },
  ];

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-amber-golden/10 border-primary/20 overflow-hidden">
        <CardContent className="p-4 sm:p-5 relative">
          <div className="relative z-10">
            <h2 className="text-lg font-bold">
              Welcome back, {user?.firstName}! 👋
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Discover amazing local shops and find what you need
            </p>
          </div>
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -translate-y-10 translate-x-10" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary/5 rounded-full translate-y-8 -translate-x-8" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border hover:border-primary/20 transition-colors">
            <CardContent className="p-3 text-center">
              <div className={`p-1.5 rounded-lg ${stat.bg} mx-auto mb-1.5 w-fit`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
              <p className="text-sm sm:text-base font-bold">{stat.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
