"use client";

import ShopNav from "@/components/ShopNav";
import { ShoppingBag } from "lucide-react";

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-background">
      <ShopNav />
      <main className="mx-auto max-w-5xl p-3 sm:p-4">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ShoppingBag className="h-5 w-5 text-brand" />
          Orders
        </h1>
      </main>
    </div>
  );
}
