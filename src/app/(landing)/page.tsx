import { Suspense } from "react";
import Storefront from "@/components/landing/Storefront";

export default function StorePage() {
  // Storefront reads its filters from the URL with useSearchParams.
  return (
    <Suspense>
      <Storefront />
    </Suspense>
  );
}
