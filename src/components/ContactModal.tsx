"use client";

import { useModalBack } from "@/hooks/useModalBack";
import {
  X,
  User,
  MapPin,
  Phone,
  Mail,
  Star,
  Store,
  MessageSquare,
  ShoppingBag,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ContactInfo {
  id: string;
  name: string;
  role: "customer" | "shop_owner";
  avatar?: string;
  location?: string;
  phone?: string;
  email?: string;
  rating?: number;
  shopName?: string;
  joinDate?: string;
  totalPosts?: number;
  verified?: boolean;
}

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: ContactInfo;
  onMessageClick?: () => void;
  onDealClick?: () => void;
}

export default function ContactModal({
  isOpen,
  onClose,
  contact,
  onMessageClick,
  onDealClick,
}: ContactModalProps) {
  useModalBack(isOpen, onClose);

  const infoItems = [
    contact.shopName && { icon: Store, label: "Shop", value: contact.shopName, color: "text-brand" },
    contact.location && { icon: MapPin, label: "Location", value: contact.location, color: "text-teal-500" },
    contact.phone && { icon: Phone, label: "Phone", value: contact.phone, color: "text-amber-400" },
    contact.email && { icon: Mail, label: "Email", value: contact.email, color: "text-rose-400" },
    contact.joinDate && { icon: Calendar, label: "Member since", value: contact.joinDate, color: "text-muted-foreground" },
    contact.totalPosts && { icon: MessageSquare, label: "Posts", value: `${contact.totalPosts} posts`, color: "text-muted-foreground" },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string; color: string }[];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Contact Info</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1">
          {/* Profile */}
          <div className="text-center mb-5">
            <div className="w-16 h-16 bg-gradient-to-r from-primary to-amber-golden rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold text-primary-foreground">
                {contact.name.charAt(0)}
              </span>
            </div>
            <h4 className="text-lg font-semibold">{contact.name}</h4>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" className="capitalize">
                {contact.role === "shop_owner" ? (
                  <Store className="h-3 w-3 mr-1" />
                ) : (
                  <User className="h-3 w-3 mr-1" />
                )}
                {contact.role.replace("_", " ")}
              </Badge>
              {contact.verified && (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  ✓ Verified
                </Badge>
              )}
            </div>
          </div>

          {/* Rating */}
          {contact.rating && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <span className="font-semibold">{contact.rating}</span>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < Math.floor(contact.rating || 0) ? "text-yellow-400 fill-yellow-400" : "text-muted"}`}
                  />
                ))}
              </div>
            </div>
          )}

          <Separator className="mb-4" />

          {/* Info items */}
          <div className="space-y-2">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-border space-y-2 shrink-0">
          {contact.role === "shop_owner" && onDealClick && (
            <Button
              onClick={onDealClick}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Make Deal
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onMessageClick}
            className="w-full"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
