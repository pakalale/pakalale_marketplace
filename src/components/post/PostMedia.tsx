"use client";

import { useState } from "react";
import ImageWithFallback from "@/components/ImageWithFallback";
import ImageViewerModal from "@/components/ImageViewerModal";
import { isProductVideo } from "@/lib/product";

interface PostMediaProps {
  images: string[];
}

export default function PostMedia({ images }: PostMediaProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  if (images.length === 0) return null;

  const open = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      {images.length === 1 ? (
        <button
          type="button"
          onClick={() => open(0)}
          aria-label="Open media"
          className="relative mt-3 block w-full aspect-[4/3] overflow-hidden rounded-lg bg-muted"
        >
          {isProductVideo(images[0]) ? (
            <video src={images[0]} className="absolute inset-0 h-full w-full object-cover" controls playsInline preload="metadata" />
          ) : (
            <ImageWithFallback src={images[0]} alt="Post media" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-0.5 overflow-hidden rounded-lg">
          {images.slice(0, 4).map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => open(index)}
              aria-label={`Open media ${index + 1}`}
              className="relative aspect-square bg-muted"
            >
              {isProductVideo(image) ? (
                <video src={image} className="h-full w-full object-cover" muted preload="metadata" />
              ) : (
                <ImageWithFallback src={image} alt="Post media" className="h-full w-full object-cover" />
              )}
              {index === 3 && images.length > 4 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white">
                  +{images.length - 4}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <ImageViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={images}
        initialIndex={viewerIndex}
        alt="Post media"
      />
    </>
  );
}
