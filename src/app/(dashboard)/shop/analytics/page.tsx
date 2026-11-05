"use client";

import { BarChart3, TrendingUp, PieChart, Eye, ShoppingBag, DollarSign, Loader2, Package } from "lucide-react";
import ShopNav from "@/components/ShopNav";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import { useAnalytics } from "@/hooks/useApi";

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const { data: analytics, loading } = useAnalytics(user?.id || null);

  const stats = analytics?.stats;
  const topProducts = analytics?.topProducts || [];

  const statCards = stats
    ? [
        { icon: Eye, value: stats.totalViews.toLocaleString(), label: "Total Views", color: "text-blue-400", bg: "bg-blue-400/10" },
        { icon: ShoppingBag, value: stats.totalOrders.toString(), label: "Total Orders", color: "text-emerald-400", bg: "bg-emerald-400/10" },
        { icon: DollarSign, value: `K ${stats.totalRevenue.toLocaleString()}`, label: "Revenue", color: "text-yellow-400", bg: "bg-yellow-400/10" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="p-3 sm:p-4 space-y-4 max-w-5xl mx-auto">
        <h1 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-brand" />Analytics</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {statCards.map((stat) => (
                <Card key={stat.label} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="text-xl font-bold mt-1">{stat.value}</p>
                      </div>
                      <div className={`p-2.5 rounded-lg ${stat.bg}`}><stat.icon className={`h-5 w-5 ${stat.color}`} /></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Top Products */}
            {topProducts.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-0">
                  <div className="p-3 border-b border-border">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-brand" />Top Products</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {topProducts.map((p) => (
                      <div key={p.id} className="p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium truncate">{p.name}</h4>
                            <p className="text-xs text-muted-foreground">{p.views} views · K{p.price.toLocaleString()}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">{p.stock} in stock</p>
                            <p className="text-[10px] text-muted-foreground">★ {p.rating} ({p.reviews})</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brand" />Revenue Trend</h3>
                  <div className="h-48 bg-muted/50 rounded-lg flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Revenue chart coming soon</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><PieChart className="h-4 w-4 text-brand" />Sales by Category</h3>
                  <div className="h-48 bg-muted/50 rounded-lg flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Category chart coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
