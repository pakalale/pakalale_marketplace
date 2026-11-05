"use client";

import { User, Bell, Shield, LogOut, HelpCircle } from "lucide-react";
import { useModalBack } from "@/hooks/useModalBack";
import { useAuthStore } from "@/store/authStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggleRow } from "@/components/theme/ThemeToggle";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function SettingsModal({ isOpen, onClose, onLogout }: SettingsModalProps) {
  useModalBack(isOpen, onClose);
  const { user } = useAuthStore();

  const sections = [
    {
      title: "Account",
      icon: User,
      items: [
        { label: "Profile", value: `${user?.firstName} ${user?.lastName}` },
        { label: "Email", value: user?.email },
        { label: "Location", value: user?.location || "Not set" },
        { label: "Account Type", value: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Customer" },
      ],
    },
    {
      title: "Notifications",
      icon: Bell,
      items: [
        { label: "Push Notifications", value: "Enabled" },
        { label: "Deal Alerts", value: "Enabled" },
        { label: "New Messages", value: "Enabled" },
      ],
    },
    {
      title: "Privacy & Security",
      icon: Shield,
      items: [
        { label: "Profile Visibility", value: "Public" },
        { label: "Location Sharing", value: "Enabled" },
        { label: "Two-Factor Auth", value: "Disabled" },
      ],
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-1">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="flex items-center gap-2 mb-2 px-1">
                <section.icon className="h-4 w-4 text-brand" />
                <h4 className="text-sm font-medium">{section.title}</h4>
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-muted/50 transition-colors">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm">{item.value}</span>
                  </div>
                ))}
              </div>
              <Separator className="mt-2" />
            </div>
          ))}

          <div className="space-y-2 mt-4 px-1">
            <Button variant="ghost" className="w-full justify-start gap-3">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Help & Support
            </Button>
            <ThemeToggleRow />
            <Separator className="my-2" />
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
