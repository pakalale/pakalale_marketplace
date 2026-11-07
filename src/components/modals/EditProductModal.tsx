"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Loader2, ImageIcon, Edit } from "lucide-react";
import { useUpload } from "@/hooks/useUpload";
import UploadProgressBar from "@/components/UploadProgressBar";
import { updateProduct, type ProductData } from "@/hooks/useApi";
import ImageViewerModal from "@/components/ImageViewerModal";

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "mkv"];
function isVideoUrl(url: string): boolean {
  try {
    const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase();
    if (ext && VIDEO_EXTENSIONS.includes(ext)) return true;
    if (url.includes("/video/upload/")) return true;
    return false;
  } catch {
    return false;
  }
}

interface EditProductModalProps {
  product: ProductData;
  onProductUpdated?: () => void;
}

const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Food & Groceries",
  "Home & Garden",
  "Health & Beauty",
  "Sports",
  "Automotive",
  "Books",
  "Toys",
  "Services",
  "Other",
];

export default function EditProductModal({
  product,
  onProductUpdated,
}: EditProductModalProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    originalPrice: "",
    category: "Other",
    stock: "0",
    tags: "",
  });

  const [images, setImages] = useState<string[]>([]);
  const { upload: uploadFile, uploading, progress: uploadProgress } = useUpload({ folder: "pakalale/products" });

  // Populate form when product changes
  useEffect(() => {
    if (open && product) {
      setForm({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        originalPrice: product.originalPrice?.toString() || "",
        category: product.category || "Other",
        stock: product.stock?.toString() || "0",
        tags: product.tags?.join(", ") || "",
      });
      setImages(product.images || []);
    }
  }, [open, product]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const result = await uploadFile(file);
      if (result?.url) {
        setImages((prev) => [...prev, result.url]);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.price) return;

    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        category: form.category,
        stock: parseInt(form.stock) || 0,
        isAvailable: parseInt(form.stock) > 0,
        images,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (form.originalPrice) {
        updateData.originalPrice = parseFloat(form.originalPrice);
        updateData.discount = Math.round(
          ((parseFloat(form.originalPrice) - parseFloat(form.price)) /
            parseFloat(form.originalPrice)) *
            100
        );
      } else {
        updateData.originalPrice = undefined;
        updateData.discount = undefined;
      }

      await updateProduct(product.id, updateData);
      setOpen(false);
      onProductUpdated?.();
    } catch (err) {
      console.error("Failed to update product:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setOpen(true)}
      >
        <Edit className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-xs">Product Images</Label>
              <div className="flex flex-col gap-2">
                {images.length > 0 && (
                  images.length === 1 ? (
                    <div className="w-full h-48 bg-muted rounded-lg overflow-hidden cursor-pointer relative group" onClick={() => { setViewerIndex(0); setViewerOpen(true); }}>
                      {isVideoUrl(images[0]) ? (
                        <video src={images[0]} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="metadata" />
                      ) : (
                        <img src={images[0]} alt="Product 1" className="w-full h-full object-cover" loading="lazy" />
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(0); }} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-48 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                      {images.slice(0, 2).map((img, i) => (
                        <div key={i} className="relative bg-muted cursor-pointer aspect-square h-full group" onClick={() => { setViewerIndex(i); setViewerOpen(true); }}>
                          {isVideoUrl(img) ? (
                            <video src={img} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="metadata" />
                          ) : (
                            <img src={img} alt={`Product ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                          )}
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-4 w-4" />
                          </button>
                          {i === 1 && images.length > 2 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                              <span className="text-white text-lg font-bold">+{images.length - 2}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-12 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center gap-2 transition-colors text-muted-foreground hover:text-brand"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-sm font-medium">Add Photo/Video</span>
                    </>
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <UploadProgressBar uploading={uploading} progress={uploadProgress} />
            </div>

            {/* Product Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Product Name *</Label>
              <Input
                placeholder="e.g. iPhone 15 Pro"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">Description *</Label>
              <Textarea
                placeholder="Describe your product..."
                required
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Price & Original Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Price (K) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, price: e.target.value }))
                  }
                  min="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Original Price (K)</Label>
                <Input
                  type="number"
                  placeholder="Optional"
                  value={form.originalPrice}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, originalPrice: e.target.value }))
                  }
                  min="0"
                />
              </div>
            </div>

            {/* Category & Stock */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stock Quantity</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, stock: e.target.value }))
                  }
                  min="0"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tags (comma separated)</Label>
              <Input
                placeholder="e.g. phone, apple, flagship"
                value={form.tags}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tags: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.name.trim() || !form.description.trim() || !form.price}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={images}
        initialIndex={viewerIndex}
        onDeleteImage={removeImage}
        alt="Product image"
      />
    </>
  );
}
