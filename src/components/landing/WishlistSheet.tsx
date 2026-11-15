"use client";

import { useRouter } from "next/navigation";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHydrated } from "@/hooks/useHydrated";
import { cartLineFromProduct } from "@/lib/cart";
import { formatKwacha, productImage } from "@/lib/product";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

export default function WishlistSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { items, remove } = useWishlistStore();
  const addItem = useCartStore((state) => state.addItem);
  const mounted = useHydrated();

  const saved = mounted ? items : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border p-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-left">
            <Heart className="h-4 w-4 text-brand" />
            Saved items
            {saved.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {saved.length}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Keep the products you like here and add them to your cart whenever you are ready.
          </DialogDescription>
        </DialogHeader>

        {saved.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <Heart className="h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">Nothing saved yet</p>
            <p className="text-sm text-muted-foreground">Tap the heart on a product to keep it here.</p>
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              Browse products
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {saved.map((product) => {
                const image = productImage(product);
                const line = cartLineFromProduct(product);
                return (
                  <div key={product.id} className="flex gap-3 rounded-xl border border-border bg-card p-2.5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
                      <p className="mt-0.5 text-sm font-bold text-brand">{formatKwacha(product.price)}</p>
                      <Button
                        size="sm"
                        className="mt-1.5 h-8"
                        disabled={!line || product.stock <= 0}
                        onClick={() => {
                          if (!line) return;
                          addItem(line);
                          toast.success(`${product.name} added to cart`);
                        }}
                      >
                        Add to Cart
                      </Button>
                    </div>
                    <button
                      onClick={() => remove(product.id)}
                      aria-label={`Remove ${product.name}`}
                      className="self-start rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border bg-card p-4">
              <Button
                variant="outline"
                className="h-11 w-full rounded-full text-sm font-semibold"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/saved");
                }}
              >
                View all saved items
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
