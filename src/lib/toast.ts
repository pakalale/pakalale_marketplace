import toast from "react-hot-toast";

/**
 * Cart feedback shares one toast id, so adding several products in a row
 * replaces the previous toast instead of stacking a wall of them. Adds made in
 * quick succession are counted and reported as "N items added to cart".
 */
const CART_TOAST_ID = "cart-add";
const CART_ERROR_TOAST_ID = "cart-add-error";
const BURST_WINDOW_MS = 2000;

let burstCount = 0;
let burstReset: ReturnType<typeof setTimeout> | null = null;

export function toastAddedToCart(productName: string) {
  burstCount += 1;
  if (burstReset) clearTimeout(burstReset);
  burstReset = setTimeout(() => {
    burstCount = 0;
  }, BURST_WINDOW_MS);

  toast.success(
    burstCount > 1 ? `${burstCount} items added to cart` : `${productName} added to cart`,
    { id: CART_TOAST_ID }
  );
}

export function toastProductUnavailable() {
  toast.error("This product is not available to order right now.", {
    id: CART_ERROR_TOAST_ID,
  });
}
