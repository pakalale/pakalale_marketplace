import CheckoutView from "@/components/checkout/CheckoutView";

// Guests check out here; signed-in customers are moved to /customer/checkout
// by the store layout so they stay inside their account.
export default function StoreCheckoutPage() {
  return <CheckoutView shopHref="/" />;
}
