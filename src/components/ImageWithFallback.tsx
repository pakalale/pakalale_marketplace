"use client";

import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import { IMAGE_PLACEHOLDERS } from "@/lib/placeholders";

type ImageWithFallbackProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallbackSrc?: string;
};

export default function ImageWithFallback({
  src,
  fallbackSrc = IMAGE_PLACEHOLDERS.general,
  onError,
  onLoad,
  ...props
}: ImageWithFallbackProps) {
  const imageSrc = typeof src === "string" && src.trim() ? src.trim() : fallbackSrc;

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    onError?.(event);
    const image = event.currentTarget;
    if (image.getAttribute("src") !== fallbackSrc) {
      image.setAttribute("src", fallbackSrc);
    } else {
      image.style.visibility = "hidden";
    }
  };

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.visibility = "visible";
    onLoad?.(event);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || ""} src={imageSrc} onError={handleError} onLoad={handleLoad} />
  );
}