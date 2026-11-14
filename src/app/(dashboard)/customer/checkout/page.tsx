"use client";

import Header from "@/components/Header";
import CheckoutView from "@/components/checkout/CheckoutView";

export default function CustomerCheckoutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header activeTab="cart" />
      {/* Same width as the account header above. */}
      <main className="mx-auto max-w-5xl pb-24">
        <CheckoutView shopHref="/customer/locations" />
      </main>
    </div>
  );
}
