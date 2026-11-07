import type { ProductData } from "@/hooks/useApi";

const VIDEO_URL = /\/video\/upload\/|\.(mp4|webm|mov|avi|mkv|m3u8|mpd)(?:[?#]|$)/i;

function cloudflareStreamInfo(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const isStreamHost = hostname === "videodelivery.net"
      || hostname.endsWith(".videodelivery.net")
      || hostname.endsWith(".cloudflarestream.com");
    if (!isStreamHost) return null;

    const videoId = url.pathname.split("/").filter(Boolean)[0];
    if (!videoId) return null;

    return { hostname, videoId };
  } catch {
    return null;
  }
}

export function isProductVideo(url: string) {
  const value = url.trim();
  if (VIDEO_URL.test(value)) return true;

  const streamInfo = cloudflareStreamInfo(value);
  if (!streamInfo) return false;
  if (streamInfo.hostname === "iframe.videodelivery.net") return true;

  try {
    const pathname = new URL(value).pathname;
    return /\/(manifest|downloads|iframe)(?:\/|$)/i.test(pathname);
  } catch {
    return false;
  }
}

export function cloudflareStreamPlayerUrl(value: string) {
  const streamInfo = cloudflareStreamInfo(value);
  if (!streamInfo) return null;

  return streamInfo.hostname.endsWith(".cloudflarestream.com")
    ? `https://${streamInfo.hostname}/${streamInfo.videoId}/iframe`
    : `https://iframe.videodelivery.net/${streamInfo.videoId}`;
}

export function cloudflareStreamThumbnailUrl(value: string) {
  const streamInfo = cloudflareStreamInfo(value);
  if (!streamInfo) return null;

  const hostname = streamInfo.hostname.endsWith(".cloudflarestream.com")
    ? streamInfo.hostname
    : "videodelivery.net";
  return `https://${hostname}/${streamInfo.videoId}/thumbnails/thumbnail.jpg?time=1s`;
}

/** Product photos in display order. `images` can also hold videos and blanks. */
export function productImages(product: Pick<ProductData, "images">) {
  return product.images?.filter((url) => {
    const imageUrl = url?.trim();
    return imageUrl && !isProductVideo(imageUrl);
  }).map((url) => url.trim()) || [];
}

/** Product videos in display order. */
export function productVideos(product: Pick<ProductData, "images">) {
  return product.images?.filter((url) => {
    const mediaUrl = url?.trim();
    return mediaUrl && isProductVideo(mediaUrl);
  }).map((url) => url.trim()) || [];
}

/** First usable photo for a product. */
export function productImage(product: Pick<ProductData, "images">) {
  return productImages(product)[0];
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
