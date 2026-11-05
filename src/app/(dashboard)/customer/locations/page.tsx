"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Star, Search, Filter, ArrowRight, Loader2, Store, Eye, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocations, type LocationData } from "@/hooks/useApi";
import { useOnlineStore } from "@/store/onlineStore";

export default function LocationsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");
  const onlineUserIds = useOnlineStore((s) => s.onlineUserIds);

  const { data, loading } = useLocations({ search: searchQuery || undefined, specialty: selectedSpecialty });

  const locations = data?.locations || [];

  // Collect all unique specialties across locations for the filter
  const allSpecialties = ["all", ...Array.from(new Set(locations.flatMap((l) => l.specialties || [])))];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="w-16" />
          <h1 className="text-sm font-bold">Locations</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 max-w-5xl mx-auto">
        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative sm:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              {allSpecialties.map((s) => (
                <option key={s} value={s}>{s === "all" ? "All Categories" : s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Locations Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-2 w-full" /><Skeleton className="h-2 w-3/4" />
                <div className="flex gap-1"><Skeleton className="h-4 w-14 rounded" /><Skeleton className="h-4 w-14 rounded" /></div>
                <div className="flex items-center gap-2"><Skeleton className="h-2 w-10" /><Skeleton className="h-2 w-10" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {locations.map((location) => (
              <Card
                key={location.id}
                className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => router.push(`/customer/locations/${location.slug || location.id}`)}
              >
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold group-hover:text-brand transition-colors">{location.name}</h3>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand transition-colors shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{location.description}</p>

                    {/* Categories from shops */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(location.specialties || []).slice(0, 4).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                      {(location.specialties || []).length > 4 && (
                        <Badge variant="secondary" className="text-[10px]">+{(location.specialties || []).length - 4}</Badge>
                      )}
                    </div>

                    {/* Stats: rating, shops, views, active users */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        <span>{location.rating || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        <span>{location.shopCount} shops</span>
                      </div>
                      {(location as LocationData & { totalViews?: number }).totalViews ? (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>{(location as LocationData & { totalViews?: number }).totalViews} views</span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span>{onlineUserIds.size} online</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && locations.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No locations found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
