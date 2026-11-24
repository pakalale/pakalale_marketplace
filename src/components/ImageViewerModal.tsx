"use client";

import { useState, useRef, useEffect } from "react";
import { useModalBack } from "@/hooks/useModalBack";
import { X } from "lucide-react";
import ImageWithFallback from "@/components/ImageWithFallback";
import { cloudflareStreamPlayerUrl, isProductVideo } from "@/lib/product";

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  alt?: string;
  onDeleteImage?: (index: number) => void;
}

export default function ImageViewerModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  alt = "",
  onDeleteImage,
}: ImageViewerModalProps) {
  useModalBack(isOpen, onClose);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    if (isOpen) setCurrentIndex(initialIndex);
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  const goNext = () => setCurrentIndex((prev) => Math.min(prev + 1, images.length - 1));
  const goPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 50) goNext();
    else if (diff < -50) goPrev();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") goNext();
    else if (e.key === "ArrowLeft") goPrev();
    else if (e.key === "Escape") onClose();
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="absolute top-4 right-4 z-10 flex gap-3">
        {onDeleteImage && (
          <button
            onClick={() => {
              onDeleteImage(currentIndex);
              if (images.length === 1) {
                onClose();
              } else if (currentIndex >= images.length - 1) {
                setCurrentIndex(currentIndex - 1);
              }
            }}
            className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/10 px-3 py-1 rounded-full">
          <span className="text-white text-xs font-medium">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
      )}

      <div
        className="flex-1 w-full flex items-center justify-center px-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isProductVideo(images[currentIndex]) ? (
          cloudflareStreamPlayerUrl(images[currentIndex]) ? (
            <iframe
              src={cloudflareStreamPlayerUrl(images[currentIndex])!}
              title={`Video ${currentIndex + 1}`}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              className="aspect-video max-h-[85vh] w-[min(90vw,1280px)] bg-black"
            />
          ) : (
            <video
              src={images[currentIndex]}
              className="max-h-[85vh] max-w-full object-contain select-none"
              controls
              autoPlay
              playsInline
            />
          )
        ) : (
          <ImageWithFallback
            src={images[currentIndex]}
            alt={alt}
            className="max-h-[85vh] max-w-full object-contain select-none"
            draggable={false}
          />
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-1.5 pb-6 pt-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentIndex ? "bg-white w-5" : "bg-white/30 w-2"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
