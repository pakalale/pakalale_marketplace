"use client";

import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatKwacha, productImage, productShopId, productShopName } from "@/lib/product";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

export default function WishlistSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, remove } = useWishlistStore();
  const addItem = useCartStore((state) => state.addItem);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-left">
            <Heart className="h-4 w-4 text-brand" />
            Saved items
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <Heart className="h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">Nothing saved yet</p>
            <p className="text-sm text-muted-foreground">Tap the heart on a product to keep it here.</p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {items.map((product) => {
              const image = productImage(product);
              const shopId = productShopId(product);
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
                      disabled={!shopId || product.stock <= 0}
                      onClick={() => {
                        addItem({
                          productId: product.id,
                          name: product.name,
                          image,
                          price: product.price,
                          originalPrice: product.originalPrice,
                          stock: product.stock,
                          shopId,
                          shopName: productShopName(product) || undefined,
                        });
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
        )}
      </SheetContent>
    </Sheet>
  );
}
