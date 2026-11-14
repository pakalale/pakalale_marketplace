"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Heart,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShoppingCart,
  UserPlus,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Container from "@/components/landing/Container";
import StoreSearch from "@/components/landing/StoreSearch";
import { useHydrated } from "@/hooks/useHydrated";
import { loginHref } from "@/lib/authRedirect";
import { ACCOUNT_LINKS, PRIMARY_LINKS, accountHome } from "@/lib/siteNav";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { cartItemCount, useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import MobileMenu from "./MobileMenu";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e5252a] px-1 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

const iconButton =
  "relative flex h-10 w-10 items-center justify-center rounded-full text-brand transition-colors hover:bg-muted";

function SearchBar({ onOpen }: { onOpen: () => void }) {
  const query = useSearchParams().get("q") || "";
  // Opens the full search panel (suggestions, shops, recent searches).
  return (
    <div className="flex h-12 w-full items-center rounded-full border border-border bg-card pl-4 pr-1 shadow-[0_2px_10px_rgba(0,37,131,0.06)]">
      <Search className="h-5 w-5 shrink-0 text-brand" />
      <input
        type="search"
        readOnly
        value={query}
        onClick={onOpen}
        onFocus={onOpen}
        placeholder="Search for products..."
        aria-label="Search for products"
        className="h-full min-w-0 flex-1 cursor-pointer bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="button"
        onClick={onOpen}
        className="h-10 shrink-0 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Search
      </button>
    </div>
  );
}

function PrimaryNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  return <PrimaryNavLinks pathname={pathname} params={params} />;
}

function PrimaryNavLinks({ pathname, params }: { pathname: string; params: URLSearchParams | null }) {
  return (
    <>
      {PRIMARY_LINKS.map((link) => {
        const active = params ? link.isActive(pathname, params) : false;
        return (
          <Link
            key={link.label}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-full shrink-0 items-center border-b-[3px] px-3 text-sm font-medium transition-colors xl:px-4",
              active ? "border-primary text-primary" : "border-transparent text-white/90 hover:text-white"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const signedIn = useHydrated() && isAuthenticated && Boolean(user);
  const home = accountHome(user?.role);
  const inAccount = pathname.startsWith("/customer");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-brand outline-none transition-colors hover:bg-muted",
          inAccount && "bg-brand/10"
        )}
      >
        {signedIn && user?.avatar ? (
          <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <UserRound className="h-[22px] w-[22px]" />
        )}
        <span className="hidden max-w-28 truncate lg:inline">{signedIn ? user?.firstName || "Account" : "Account"}</span>
        <ChevronDown className="hidden h-4 w-4 lg:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-1.5">
        {signedIn ? (
          <>
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            {user?.role === "customer" ? (
              ACCOUNT_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} className="py-2" onClick={() => router.push(link.href)}>
                  <link.icon /> {link.label === "Overview" ? "My account" : link.label}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem className="py-2" onClick={() => router.push(home.href)}>
                <LayoutGrid /> {home.label}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
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
            <DropdownMenuItem className="py-2" onClick={() => router.push(pathname === "/" ? "/login" : loginHref(pathname))}>
              <LogIn /> Sign in
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2" onClick={() => router.push("/signup")}>
              <UserPlus /> Create account
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The header on every customer-facing page: logo home, search, account and
 * cart in the top row, and the same primary links underneath.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const mounted = useHydrated();
  const { user, isAuthenticated } = useAuthStore();
  const cartCount = useCartStore((state) => cartItemCount(state.items));
  const savedCount = useWishlistStore((state) => state.items.length);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const signedInCustomer = mounted && isAuthenticated && user?.role === "customer";
  const savedHref = signedInCustomer ? "/customer/saved" : "/saved";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/95 backdrop-blur-lg">
        <Container className="flex h-16 max-w-[1440px] items-center gap-2 sm:h-20 lg:gap-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className={cn(iconButton, "-ml-2 lg:hidden")}
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link href="/" aria-label="PakalaleMarket home" className="shrink-0">
            <Image src="/logo.jpeg" alt="PakalaleMarket" className="h-11 w-auto sm:h-14" width={320} height={112} priority />
          </Link>

          <div className="hidden max-w-2xl flex-1 md:block">
            <Suspense fallback={<div className="h-12 w-full rounded-full border border-border bg-card" />}>
              <SearchBar onOpen={() => setSearchOpen(true)} />
            </Suspense>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search" className={cn(iconButton, "md:hidden")}>
              <Search className="h-[22px] w-[22px]" />
            </button>
            <AccountMenu />
            <Link
              href={savedHref}
              aria-label={`Saved items, ${savedCount}`}
              aria-current={pathname === savedHref ? "page" : undefined}
              className={cn(iconButton, "hidden sm:flex", pathname === savedHref && "bg-brand/10")}
            >
              <Heart className="h-[22px] w-[22px]" />
              <CountBadge count={mounted ? savedCount : 0} />
            </Link>
            <Link
              href="/cart"
              aria-label={`Cart, ${cartCount} items`}
              aria-current={pathname === "/cart" ? "page" : undefined}
              className={cn(iconButton, (pathname === "/cart" || pathname === "/checkout") && "bg-brand/10")}
            >
              <ShoppingCart className="h-[22px] w-[22px]" />
              <CountBadge count={mounted ? cartCount : 0} />
            </Link>
          </div>
        </Container>
      </header>

      <nav aria-label="Main" className="hidden bg-[#002583] lg:block">
        <Container className="flex h-12 max-w-[1440px] items-stretch justify-center gap-2 xl:gap-4">
          <Suspense fallback={<PrimaryNavLinks pathname={pathname} params={null} />}>
            <PrimaryNav />
          </Suspense>
        </Container>
      </nav>

      <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} savedHref={savedHref} />
      <StoreSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
