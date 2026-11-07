"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpload } from "@/hooks/useUpload";
import UploadProgressBar from "@/components/UploadProgressBar";
import { Plus, Upload, X, Loader2, ImageIcon } from "lucide-react";
import { createProduct, type ProductData } from "@/hooks/useApi";
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

interface AddProductModalProps {
  shopId: string;
  onProductAdded?: (product: ProductData) => void;
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

export default function AddProductModal({
  shopId,
  onProductAdded,
}: AddProductModalProps) {
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
    stock: "1",
    tags: "",
  });

  const [images, setImages] = useState<string[]>([]);
  const { upload: uploadFile, uploading, progress: uploadProgress } = useUpload({ folder: "pakalale/products" });
  const hasProductPhoto = images.some((image) => !isVideoUrl(image));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const result = await uploadFile(file);
      if (result?.url) {
        setImages((prev) => [...prev, result.url]);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.price) return;
    if (!hasProductPhoto) return;

    setSaving(true);
    try {
      const productData = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        originalPrice: form.originalPrice
          ? parseFloat(form.originalPrice)
          : undefined,
        discount: form.originalPrice
          ? Math.round(
              ((parseFloat(form.originalPrice) - parseFloat(form.price)) /
                parseFloat(form.originalPrice)) *
                100
            )
          : undefined,
        category: form.category,
        stock: parseInt(form.stock) || 0,
        isAvailable: parseInt(form.stock) > 0,
        shopId,
        images,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        views: 0,
        rating: 5,
        reviews: 0,
      };

      const result = await createProduct(productData);
      if (!result?.product) throw new Error(result?.error || "Failed to create product");
      const savedProduct = result.product as ProductData;

      // Reset form
      setForm({
        name: "",
        description: "",
        price: "",
        originalPrice: "",
        category: "Other",
        stock: "1",
        tags: "",
      });
      setImages([]);
      setOpen(false);
      onProductAdded?.({ ...productData, ...savedProduct, id: savedProduct.id } as ProductData);
    } catch (err) {
      console.error("Failed to create product:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          />
        }
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Product
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
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
            <p className="text-[10px] text-muted-foreground">
              Add at least one product photo. Photos should be JPEG, PNG, or WebP (max 5MB each).
            </p>
            <UploadProgressBar uploading={uploading} progress={uploadProgress} />
          </div>

          {/* Product Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Product Name *</Label>
            <Input
              placeholder="e.g. iPhone 15 Pro"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.name.trim() || !form.description.trim() || !form.price || !hasProductPhoto}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {saving ? "Adding..." : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ImageViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={images}
        initialIndex={viewerIndex}
        onDeleteImage={removeImage}
        alt="Product image"
      />
    </Dialog>
  );
}
