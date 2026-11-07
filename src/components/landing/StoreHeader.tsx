"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Search,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
  UserRound,
  Users,
  Truck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHydrated } from "@/hooks/useHydrated";
import { useAuthStore } from "@/store/authStore";
import { STORE_CATEGORIES, categoryHref } from "@/lib/storeCategories";
import { cn } from "@/lib/utils";
import Container from "./Container";
import StoreSearch from "./StoreSearch";

interface StoreHeaderProps {
  cartCount: number;
  wishlistCount: number;
  onCartOpen: () => void;
  onWishlistOpen: () => void;
}

function dashboardPath(role?: string) {
  if (role === "admin") return "/admin";
  if (role === "shop_owner") return "/shop/feed";
  return "/customer";
}

function SearchField({ onOpen }: { onOpen: () => void }) {
  const urlQuery = useSearchParams().get("q") || "";

  // Read-only on purpose: tapping it opens the same search experience the feed
  // uses, so visitors can search before they have an account.
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        readOnly
        value={urlQuery}
        onClick={onOpen}
        onFocus={onOpen}
        placeholder="Search for products..."
        aria-label="Search for products"
        className="h-11 w-full cursor-pointer rounded-full border border-border bg-muted/60 pl-11 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/40 focus:bg-card [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}

function HeaderSearch({ onOpen }: { onOpen: () => void }) {
  return (
    <Suspense fallback={<div className="h-11 w-full rounded-full border border-border bg-muted/60" />}>
      <SearchField onOpen={onOpen} />
    </Suspense>
  );
}

function CountBadge({ count, always }: { count: number; always?: boolean }) {
  if (count <= 0 && !always) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

const iconButton =
  "relative flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted sm:h-10 sm:w-10";

export default function StoreHeader({
  cartCount,
  wishlistCount,
  onCartOpen,
  onWishlistOpen,
}: StoreHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const signedIn = useHydrated() && isAuthenticated;
  const [searchOpen, setSearchOpen] = useState(false);

  const tabs = [
    { href: "/", label: "Shop", icon: ShoppingBag, active: pathname === "/" },
    { href: "/feed", label: "Feed", icon: Users, active: pathname === "/feed" },
  ];
  const navLink =
    "shrink-0 rounded-full px-2.5 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-muted sm:px-4";

  return (
    <>
      <div className="bg-[#002583] text-white">
        <Container className="flex h-9 items-center gap-2.5 text-xs font-medium sm:text-[13px]">
          <Truck className="h-4 w-4 shrink-0" />
          <span className="truncate">Free Shipping on orders over K500 across Zambia</span>
        </Container>
      </div>

      <header className="sticky top-0 z-50 border-b border-border/70 bg-card/95 backdrop-blur-lg">
        <Container className="flex h-16 items-center justify-between gap-3 sm:h-[72px] lg:gap-8">
          <Image src="/logo.jpeg" alt="Pakalale Market" className="h-8 w-auto shrink-0 sm:h-9" width={320} height={112} priority />

          <div className="hidden max-w-xl flex-1 md:block">
            <HeaderSearch onOpen={() => setSearchOpen(true)} />
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account"
                className="flex h-9 items-center gap-1.5 rounded-full px-1.5 text-sm sm:h-10 sm:px-2 font-medium outline-none transition-colors hover:bg-muted"
              >
                {signedIn && user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <UserRound className="h-[22px] w-[22px]" />
                )}
                <span className="hidden max-w-24 truncate lg:inline">
                  {signedIn ? user?.firstName || "Account" : "Account"}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 lg:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-52 p-1.5">
                {signedIn ? (
                  <>
                    <div className="px-2 py-1.5">
                      <p className="truncate text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="py-2" onClick={() => router.push(dashboardPath(user?.role))}>
                      <LayoutDashboard /> My dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="py-2"
                      variant="destructive"
                      onClick={() => {
                        logout();
                        router.push("/");
                      }}
                    >
                      <LogOut /> Sign out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem className="py-2" onClick={() => router.push("/login")}>
                      <LogIn /> Sign in
                    </DropdownMenuItem>
                    <DropdownMenuItem className="py-2" onClick={() => router.push("/signup")}>
                      <UserPlus /> Create account
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <button className={iconButton} onClick={onWishlistOpen} aria-label="Saved items">
              <Heart className="h-[22px] w-[22px]" />
              <CountBadge count={wishlistCount} />
            </button>

            <button className={iconButton} onClick={onCartOpen} aria-label={`Cart, ${cartCount} items`}>
              <ShoppingCart className="h-[22px] w-[22px]" />
              <CountBadge count={cartCount} always />
            </button>
          </div>
        </Container>
      </header>

      <div className="bg-card">
        <div className="pb-2 md:hidden">
          <Container>
            <HeaderSearch onOpen={() => setSearchOpen(true)} />
          </Container>
        </div>

        <Container>
          <nav aria-label="Store" className="flex items-center gap-0.5 overflow-x-auto py-2 [scrollbar-width:none] sm:gap-1.5">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors sm:px-4",
                  tab.active ? "bg-primary text-primary-foreground" : "text-brand hover:bg-muted"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            ))}

            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

            <DropdownMenu>
              <DropdownMenuTrigger className={cn(navLink, "flex items-center gap-1 outline-none")}>
                Categories
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent sideOffset={8} className="w-56 p-1.5">
                {STORE_CATEGORIES.map((group) => (
                  <DropdownMenuItem
                    key={group.label}
                    className="py-2"
                    onClick={() => router.push(categoryHref(group.label))}
                  >
                    {group.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="py-2 font-semibold" onClick={() => router.push("/#products")}>
                  All products
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/?sale=1#products" className={navLink}>
              Deals
            </Link>

            <Link
              href="/signup"
              className="ml-auto hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-brand sm:block"
            >
              Sell on Pakalale
            </Link>
          </nav>
        </Container>
      </div>

      <StoreSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
