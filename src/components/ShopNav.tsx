"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/store/notificationStore";
import { useNavScrollVisibility } from "@/hooks/useNavScrollVisibility";
import { shopNavItems } from "@/components/ShopBottomNav";

export default function ShopNav() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const navVisible = useNavScrollVisibility();

  // Settings and Notifications in top bar. The main sections show here on
  // desktop, where the bottom nav is hidden.
  const topLinks = [
    { to: "/shop/notifications", label: "Notifications", icon: Bell },
    { to: "/shop/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className={cn(
      "sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border transition-transform duration-300",
      navVisible ? "translate-y-0" : "-translate-y-full"
    )}>
      <div className="flex items-center justify-between gap-3 px-4 lg:px-6 h-14 max-w-7xl mx-auto">
        <Link href="/shop/overview" aria-label="Pakalale My Shop" className="flex items-center gap-2 min-w-0">
          <Image src="/logo.png" alt="Pakalale Market" className="h-8 w-auto shrink-0" width={320} height={112} priority />
        </Link>

        {/* The desktop sidebar carries the sections, so the bar stays lean at lg. */}
        <nav className="hidden sm:flex lg:hidden flex-1 items-center justify-center gap-1">
          {shopNavItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith(item.href) || (item.id === "shop" && pathname.startsWith("/shop/virtual-shop"))
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
              <span className="relative">
                <link.icon className="h-4 w-4" />
                {link.to === "/shop/notifications" && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
