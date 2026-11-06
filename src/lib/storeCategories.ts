/**
 * Storefront departments. Sellers pick fine-grained categories, so each tile
 * maps to the set of real product categories it covers.
 */
export const STORE_CATEGORIES = [
  {
    label: "Electronics",
    image: "/landing/cat-electronics.webp",
    categories: ["Electronics", "Mobile Phones", "Accessories", "Consoles", "Games", "Electrical"],
  },
  {
    label: "Computers & Laptops",
    image: "/landing/cat-computers.webp",
    categories: ["Laptops", "PC Gaming", "Office"],
  },
  {
    label: "Fashion & Footwear",
    image: "/landing/cat-fashion.webp",
    categories: ["Fashion", "Shoes"],
  },
  {
    label: "Clothing",
    image: "/landing/cat-clothing.webp",
    categories: ["Men's Wear", "Women's Wear", "Children Clothing"],
  },
  {
    label: "Home & Kitchen",
    image: "/landing/cat-home.webp",
    categories: ["Appliances", "Bedroom", "Dining", "Living Room"],
  },
  {
    label: "Beauty & Health",
    image: "/landing/cat-beauty.webp",
    categories: ["Cosmetics", "Skincare", "Haircare", "Medicine", "Vitamins", "Wellness", "Nutrition"],
  },
  {
    label: "Sports & Outdoor",
    image: "/landing/cat-sports.webp",
    categories: ["Fitness", "Gym Equipment"],
  },
];

/** Resolves a selected department or single category to API filter values. */
export function categoryFilter(selected: string) {
  return STORE_CATEGORIES.find((group) => group.label === selected)?.categories ?? selected;
}

export function categoryHref(category: string) {
  return `/?category=${encodeURIComponent(category)}#products`;
}
