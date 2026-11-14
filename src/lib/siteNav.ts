import { Bell, Heart, LayoutDashboard, MapPin, MessageSquare, Package, Settings, UserRound } from "lucide-react";
import { categoryHref } from "@/lib/storeCategories";

/**
 * Site-wide navigation. The header, mobile menu and footer all read from here
 * so every page offers the same ways forward and back.
 */

export interface PrimaryLink {
  label: string;
  href: string;
  /** Matches the current page, for the active highlight. */
  isActive: (pathname: string, params: URLSearchParams) => boolean;
}

const onHome = (pathname: string) => pathname === "/";

export const PRIMARY_LINKS: PrimaryLink[] = [
  {
    label: "Shop",
    href: "/",
    isActive: (pathname, params) => onHome(pathname) && !params.get("category") && params.get("sale") !== "1",
  },
  {
    label: "Electronics",
    href: categoryHref("Electronics"),
    isActive: (pathname, params) => onHome(pathname) && params.getAll("category").includes("Electronics"),
  },
  {
    label: "Fashion",
    href: categoryHref("Fashion & Footwear"),
    isActive: (pathname, params) => onHome(pathname) && params.getAll("category").includes("Fashion & Footwear"),
  },
  {
    label: "Deals",
    href: "/?sale=1#products",
    isActive: (pathname, params) => onHome(pathname) && params.get("sale") === "1",
  },
  { label: "Feed", href: "/feed", isActive: (pathname) => pathname.startsWith("/feed") },
  { label: "About & Contact", href: "/about", isActive: (pathname) => pathname.startsWith("/about") },
];

export const ACCOUNT_LINKS = [
  { label: "Overview", href: "/customer", icon: LayoutDashboard },
  { label: "Profile", href: "/customer/profile", icon: UserRound },
  { label: "Orders", href: "/customer/orders", icon: Package },
  { label: "Addresses", href: "/customer/addresses", icon: MapPin },
  { label: "Messages", href: "/customer/chat", icon: MessageSquare },
  { label: "Notifications", href: "/customer/notifications", icon: Bell },
  { label: "Saved", href: "/customer/saved", icon: Heart },
  { label: "Settings", href: "/customer/settings", icon: Settings },
];

export function isAccountLinkActive(href: string, pathname: string) {
  return href === "/customer" ? pathname === "/customer" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Where a signed-in person's own area lives. */
export function accountHome(role?: string) {
  if (role === "admin") return { href: "/admin", label: "Admin panel" };
  if (role === "shop_owner") return { href: "/shop/feed", label: "Seller dashboard" };
  return { href: "/customer", label: "My account" };
}

/**
 * Public contact details for the About & Contact page and footer. Leave a
 * value empty to hide it; nothing is shown until it is filled in.
 */
export const CONTACT = {
  email: "",
  phone: "",
  whatsapp: "",
  address: "Lusaka, Zambia",
};
