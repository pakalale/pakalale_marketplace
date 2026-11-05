"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Store,
  Package,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { formatTimeAgo } from "@/lib/formatTime";

interface AdminStats {
  totalUsers: number;
  totalShops: number;
  totalProducts: number;
  totalChats: number;
  totalMessages: number;
  pendingShops: number;
  verifiedShops: number;
  rejectedShops: number;
  customers: number;
  shopOwners: number;
  admins: number;
  recentUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  recentShops: Array<{
    id: string;
    name: string;
    status: string;
    ownerId: string;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/admin/stats?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Failed to load stats
      </div>
    );
  }

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
    { label: "Total Shops", value: stats.totalShops, icon: Store, color: "text-emerald-500" },
    { label: "Products", value: stats.totalProducts, icon: Package, color: "text-purple-500" },
    { label: "Messages", value: stats.totalMessages, icon: MessageSquare, color: "text-amber-500" },
    { label: "Active Chats", value: stats.totalChats, icon: ShoppingBag, color: "text-pink-500" },
    { label: "Pending Verification", value: stats.pendingShops, icon: Clock, color: "text-orange-500" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-xs text-muted-foreground">System overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map((card) => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <card.icon className={`h-5 w-5 ${card.color}`} />
                <span className="text-2xl font-bold">{card.value.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      {stats.pendingShops > 0 && (
        <Card
          className="bg-orange-500/5 border-orange-500/20 cursor-pointer hover:border-orange-500/40 transition-colors"
          onClick={() => router.push("/admin/shops?status=pending")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{stats.pendingShops} shops pending verification</p>
              <p className="text-[11px] text-muted-foreground">Review and approve shop documents</p>
            </div>
            <Badge className="bg-orange-500 text-white">Review</Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Recent Users</h3>
              <button
                onClick={() => router.push("/admin/users")}
                className="text-[11px] text-brand hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {stats.recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-2 py-1.5">
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                    {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{u.firstName} {u.lastName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[9px] shrink-0 ${
                      u.role === "admin" ? "bg-red-500/10 text-red-500" :
                      u.role === "shop_owner" ? "bg-primary/10 text-brand" :
                      ""
                    }`}
                  >
                    {u.role === "shop_owner" ? "Shop" : u.role === "admin" ? "Admin" : "Customer"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Shops */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Recent Shops</h3>
              <button
                onClick={() => router.push("/admin/shops")}
                className="text-[11px] text-brand hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {stats.recentShops.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-1.5">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatTimeAgo(s.createdAt)}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[9px] shrink-0 ${
                      s.status === "verified" ? "bg-emerald-500/10 text-emerald-500" :
                      s.status === "rejected" ? "bg-destructive/10 text-destructive" :
                      "bg-orange-500/10 text-orange-500"
                    }`}
                  >
                    {s.status === "verified" ? (
                      <><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Verified</>
                    ) : s.status === "rejected" ? (
                      <><XCircle className="h-2.5 w-2.5 mr-0.5" /> Rejected</>
                    ) : (
                      <><Clock className="h-2.5 w-2.5 mr-0.5" /> Pending</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Health */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Platform Health</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-emerald-500">{stats.verifiedShops}</p>
              <p className="text-[10px] text-muted-foreground">Verified Shops</p>
            </div>
            <div>
              <p className="text-lg font-bold text-orange-500">{stats.pendingShops}</p>
              <p className="text-[10px] text-muted-foreground">Pending Review</p>
            </div>
            <div>
              <p className="text-lg font-bold text-destructive">{stats.rejectedShops}</p>
              <p className="text-[10px] text-muted-foreground">Rejected</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
