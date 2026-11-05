"use client";

import { useEffect } from "react";
import { useModalBack } from "@/hooks/useModalBack";
import { CheckCircle, ShoppingBag, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DealSuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  quantity: number;
  totalPrice: number;
  onGoToChat?: () => void;
  onContinueBrowsing: () => void;
}

export default function DealSuccessPopup({
  isOpen,
  onClose,
  productName,
  quantity,
  totalPrice,
  onGoToChat,
  onContinueBrowsing,
}: DealSuccessPopupProps) {
  useModalBack(isOpen, onClose);

  // Auto-close after 5 seconds
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Popup */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold mb-1">Deal Created!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your deal for <span className="font-medium text-foreground">{quantity}x {productName}</span> at <span className="font-bold text-brand">K{totalPrice.toLocaleString()}</span> has been sent to the shop.
          </p>

          <div className="flex flex-col gap-2">
            {onGoToChat && (
              <Button
                onClick={onGoToChat}
                className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Go to Chat
              </Button>
            )}
            <Button
              onClick={onContinueBrowsing}
              variant="outline"
              className="w-full h-10"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Continue Browsing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
