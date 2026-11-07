import { redirect } from "next/navigation";

/** Deals moved into chats; the customer space now uses the cart instead. */
export default function DealsPage() {
  redirect("/customer/cart");
}
