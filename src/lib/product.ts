import type { ProductData } from "@/hooks/useApi";

const VIDEO_URL = /\/video\/upload\/|\.(mp4|webm|mov)(\?|$)/i;

/** First photo for a product. `images` can also hold videos and empty strings. */
export function productImage(product: Pick<ProductData, "images">) {
  return product.images?.find((url) => url && !VIDEO_URL.test(url));
}

/**
 * Percent off, or 0 when there is no real saving. Stored `discount` values can
 * be stale or negative (e.g. originalPrice below price), so prices win.
 */
export function productDiscount(product: Pick<ProductData, "price" | "originalPrice" | "discount">) {
  if (product.originalPrice) {
    return product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;
  }
  return product.discount && product.discount > 0 ? product.discount : 0;
}

export function productShopName(product: Pick<ProductData, "shopId">) {
  return typeof product.shopId === "object" && product.shopId ? product.shopId.name : "";
}

export function productShopId(product: Pick<ProductData, "shopId">) {
  return typeof product.shopId === "object" && product.shopId
    ? product.shopId.id
    : String(product.shopId || "");
}

export function formatKwacha(amount: number) {
  return `K${amount.toLocaleString()}`;
}
