"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { shopNavItems } from "@/components/ShopBottomNav";

export default function ShopNav() {
  const pathname = usePathname();

  // Settings and Notifications in top bar. The main sections show here on
  // desktop, where the bottom nav is hidden.
  const topLinks = [
    { to: "/shop/notifications", label: "Notifications", icon: Bell },
    { to: "/shop/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between gap-3 px-4 h-14 max-w-5xl mx-auto">
        <Link href="/shop/virtual-shop" aria-label="Pakalale Shop home" className="flex items-center gap-2 min-w-0">
          <Image src="/logo.jpeg" alt="Pakalale Market" className="h-8 w-auto shrink-0" width={320} height={112} priority />
          <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">Shop</span>
        </Link>

        <nav className="hidden sm:flex flex-1 items-center justify-center gap-1">
          {shopNavItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-primary/10 text-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

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
