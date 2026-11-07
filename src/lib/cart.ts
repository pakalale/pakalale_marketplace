import type { ProductData } from "@/hooks/useApi";
import type { CartItem } from "@/store/cartStore";
import { productImage, productShopId, productShopName } from "./product";

/**
 * Builds the cart line for a product shown anywhere in the storefront.
 * Returns null when the product has no shop to order from.
 */
export function cartLineFromProduct(product: ProductData): Omit<CartItem, "quantity"> | null {
  const shopId = productShopId(product);
  if (!shopId) return null;

  return {
    productId: product.id,
    name: product.name,
    image: productImage(product),
    price: product.price,
    originalPrice: product.originalPrice,
    stock: product.stock,
    shopId,
    shopName: productShopName(product) || undefined,
  };
}
