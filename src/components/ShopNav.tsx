"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Store, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ShopNav() {
  const pathname = usePathname();

  // Settings and Notifications in top bar (bottom nav handles the rest)
  const topLinks = [
    { to: "/shop/notifications", label: "Notifications", icon: Bell },
    { to: "/shop/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-primary p-1.5 rounded-lg shrink-0">
            <Store className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold truncate">Pakalale Shop</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {topLinks.map((link) => (
            <Link
              key={link.to}
              href={link.to}
              className={cn(
                "p-2 rounded-lg transition-colors",
                pathname === link.to
                  ? "bg-primary/10 text-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <link.icon className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
