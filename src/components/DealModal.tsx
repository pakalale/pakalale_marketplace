"use client";

import { useState } from "react";
import { useModalBack } from "@/hooks/useModalBack";
import { ShoppingBag, Minus, Plus, Loader2, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productPrice?: number;
  productImage?: string;
  shopName?: string;
  onSendDeal: (data: {
    quantity: number;
    suggestedPrice: number;
    message: string;
  }) => void;
  sending?: boolean;
}

export default function DealModal({
  isOpen,
  onClose,
  productName,
  productPrice,
  shopName,
  onSendDeal,
  sending,
}: DealModalProps) {
  useModalBack(isOpen, onClose);

  const [quantity, setQuantity] = useState(1);
  const [suggestedPrice, setSuggestedPrice] = useState(productPrice?.toString() || "");
  const [message, setMessage] = useState("");

  const totalPrice = quantity * (parseFloat(suggestedPrice) || 0);
  const savings = productPrice ? quantity * productPrice - totalPrice : 0;

  const handleSend = () => {
    if (!suggestedPrice || parseFloat(suggestedPrice) <= 0) return;
    const dealMessage =
      message.trim() ||
      `Hi! I'd like to order ${quantity}x ${productName} at K${Number(suggestedPrice).toLocaleString()} each (total K${totalPrice.toLocaleString()}). ${savings > 0 ? `That's K${savings.toLocaleString()} savings!` : ""} Can we make a deal?`;
    onSendDeal({ quantity, suggestedPrice: parseFloat(suggestedPrice), message: dealMessage });
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent overlayClassName="z-[70]" className="z-[70] w-[calc(100vw-2rem)] max-w-md p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col sm:w-full">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border shrink-0">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <ShoppingBag className="h-4 w-4 text-brand" />
          </div>
          <DialogTitle className="text-sm font-bold">Make a Deal</DialogTitle>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {/* Product Info */}
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[13px] truncate">{productName}</h4>
                {shopName && <p className="text-[11px] text-muted-foreground">{shopName}</p>}
                {productPrice && (
                  <p className="text-[11px] text-muted-foreground">
                    Listed at <span className="font-medium">K{productPrice.toLocaleString()}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Deal Form */}
          <div className="p-3 space-y-3">
            {/* Quantity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Quantity</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-bold">{quantity}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {quantity === 1 ? "item" : "items"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => handleQuantityChange(1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Suggested Price */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Your Price (per item)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">K</span>
                <Input
                  type="number"
                  value={suggestedPrice}
                  onChange={(e) => setSuggestedPrice(e.target.value)}
                  placeholder="0"
                  className="pl-8 text-base font-bold h-11"
                  min="1"
                  inputMode="decimal"
                />
              </div>
            </div>

            {/* Optional Message */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Message (optional)</Label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Any special requests or conditions..."
                rows={2}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Your offer</span>
                <span className="font-medium">{quantity}x K{Number(suggestedPrice || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-brand text-sm">K{totalPrice.toLocaleString()}</span>
              </div>
              {savings > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">You save</span>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-500">
                    K{savings.toLocaleString()}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions - fixed at bottom */}
        <div className="p-3 border-t border-border flex gap-2 shrink-0">
          <Button variant="outline" className="flex-1 h-10" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 h-10 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleSend}
            disabled={!suggestedPrice || parseFloat(suggestedPrice) <= 0 || sending}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageSquare className="h-4 w-4 mr-1" />}
            {sending ? "Sending..." : "Send Deal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
