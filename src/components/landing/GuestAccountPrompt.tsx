"use client";

import { useRouter } from "next/navigation";
import { Check, Heart, LogIn, MessageSquare, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const BENEFITS = [
  { icon: PackageCheck, label: "Track every order from checkout to delivery" },
  { icon: Heart, label: "Keep your saved items across all your devices" },
  { icon: MessageSquare, label: "Chat with local shops about your purchases" },
];

export default function GuestAccountPrompt({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  // Come back to the checkout that was interrupted once the account is ready.
  const continueTo = (path: string) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("redirectAfterLogin", "/checkout");
    }
    onOpenChange(false);
    router.push(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div className="relative bg-gradient-to-br from-[#002583] via-[#002583] to-[#0b3bb8] px-6 pb-7 pt-6 text-white">
          <img
            src="/logo.jpeg"
            alt="Pakalale Market"
            className="h-9 w-auto rounded-md bg-white px-1.5 py-1"
          />
          <DialogTitle className="mt-4 text-xl font-bold leading-snug">
            Create an account to check out
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-white/80">
            Your cart is saved right here. It takes less than a minute to finish your order.
          </DialogDescription>
        </div>

        <div className="p-5">
          <ul className="space-y-2.5">
            {BENEFITS.map((benefit) => (
              <li key={benefit.label} className="flex items-start gap-2.5 text-sm text-foreground/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {benefit.label}
              </li>
            ))}
          </ul>

          <div className="mt-5 space-y-2">
            <Button
              className="h-11 w-full rounded-full text-sm font-semibold"
              onClick={() => continueTo("/signup")}
            >
              Create free account
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-full text-sm font-semibold"
              onClick={() => continueTo("/login")}
            >
              <LogIn className="mr-2 h-4 w-4" /> I already have an account
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-full py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Keep browsing
            </button>
          </div>

          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            No card needed &middot; Pay cash when your order arrives
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
