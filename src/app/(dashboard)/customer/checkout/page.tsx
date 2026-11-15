import CheckoutPage from "@/components/checkout/CheckoutPage";
import Header from "@/components/Header";

export default function CustomerCheckoutRoute() {
  return (
    <>
      <Header activeTab="cart" />
      <CheckoutPage />
    </>
  );
}