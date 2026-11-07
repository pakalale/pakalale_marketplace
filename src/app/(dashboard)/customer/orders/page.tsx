"use client";

import Header from "@/components/Header";

/** Orders is intentionally empty for now; the customer cart is the live flow. */
export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header activeTab="orders" />
      <main className="mx-auto max-w-2xl p-4 pb-24">
        <h1 className="text-lg font-bold">Orders</h1>
      </main>
    </div>
  );
}
