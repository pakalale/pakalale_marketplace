"use client";

import { useState } from "react";
import ShopNav from "@/components/ShopNav";
import { ShoppingBag, Filter, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";import { useOrders } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";


const statusColors: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  preparing: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ready: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function OrdersPage() {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState("all");
  const { data, loading, error } = useOrders({ shopId: user?.id || undefined, status: statusFilter });

  const orders = data?.orders || [];

  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="p-3 sm:p-4 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-brand" />Orders</h1>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2 py-1 bg-muted border border-border rounded-md text-xs">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-0 divide-y divide-border">
              {orders.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">{error ? "We could not load your orders. Please try again." : "No orders found"}</div>
              ) : (
                orders.map((order) => {
                  const customerName = typeof order.customerId === "object" && "firstName" in order.customerId
                    ? `${(order.customerId as unknown as { firstName: string }).firstName} ${(order.customerId as unknown as { lastName: string }).lastName}`
                    : "Customer";
                  const productNames = order.items.map((item) =>
                    typeof item.productId === "object" && "name" in item.productId
                      ? (item.productId as unknown as { name: string }).name
                      : "Product"
                  ).join(", ");

                  return (
                    <div key={order.id} className="p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium truncate">{customerName}</h4>
                          <p className="text-xs text-muted-foreground truncate">{productNames}</p>
                          {order.notes && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{order.notes}</p>}
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatTimeAgo(order.createdAt)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">K{order.total.toLocaleString()}</p>
                          <Badge variant="secondary" className={`text-[10px] capitalize mt-1 ${statusColors[order.status] || ""}`}>
                            {order.status === "completed" || order.status === "confirmed" ? <CheckCircle className="h-3 w-3 mr-1" /> : order.status === "pending" ? <Clock className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
