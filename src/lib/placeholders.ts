/**
 * Category-aware stock images used when a product, shop, location or user has
 * no image of its own. Keeps cards and profiles from showing an empty/black
 * frame. These are plain remote URLs so they work with <img> without any
 * next/image domain configuration.
 */

const UNSPLASH = (id: string, width = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

export const IMAGE_PLACEHOLDERS = {
  general: UNSPLASH("photo-1441986300917-64674bd600d8"),
  phones: UNSPLASH("photo-1511707171634-5f897ff02aa9"),
  computers: UNSPLASH("photo-1517336714731-489689fd1ca8"),
  fashion: UNSPLASH("photo-1542291026-7eec264c27ff"),
  groceries: UNSPLASH("photo-1542838132-92c53300491e"),
  home: UNSPLASH("photo-1555041469-a586c61ea9bc"),
  beauty: UNSPLASH("photo-1522335789203-aabd1fc54bc9"),
  fitness: UNSPLASH("photo-1571019613454-1cb2f99b2d8b"),
  books: UNSPLASH("photo-1512820790803-83ca734da794"),
  automotive: UNSPLASH("photo-1486262715619-67b85e0b08d3"),
  pets: UNSPLASH("photo-1450778869180-41d0601e046e"),
  gaming: UNSPLASH("photo-1493711662062-fa541adb3fc8"),
  appliances: UNSPLASH("photo-1556911220-bff31c812dba"),
  market: UNSPLASH("photo-1533900298318-6b8da08a523e", 1200),
} as const;

export const DEFAULT_SHOP_COVER = IMAGE_PLACEHOLDERS.market;
export const DEFAULT_LOCATION_IMAGE = IMAGE_PLACEHOLDERS.market;

const CATEGORY_GROUPS: Array<{ keywords: string[]; images: string[] }> = [
  {
    keywords: ["phone", "mobile", "tablet", "sim", "accessor"],
    images: [
      IMAGE_PLACEHOLDERS.phones,
      UNSPLASH("photo-1592750475338-74b7b21085ab"),
      UNSPLASH("photo-1512499617640-c74ae3a79d37"),
    ],
  },
  {
    keywords: ["laptop", "computer", "pc", "electronics", "console", "gaming", "game"],
    images: [
      IMAGE_PLACEHOLDERS.computers,
      UNSPLASH("photo-1496181133206-80ce9b88a853"),
      UNSPLASH("photo-1588872657578-7efd1f1555ed"),
      IMAGE_PLACEHOLDERS.gaming,
    ],
  },
  {
    keywords: ["gaming", "console", "game"],
    images: [IMAGE_PLACEHOLDERS.gaming, IMAGE_PLACEHOLDERS.computers],
  },
  {
    keywords: ["fashion", "wear", "clothing", "shoe", "sneaker", "bag", "jewel", "watch"],
    images: [
      IMAGE_PLACEHOLDERS.fashion,
      UNSPLASH("photo-1490481651871-ab68de25d43d"),
      UNSPLASH("photo-1523275335684-37898b6baf30"),
    ],
  },
  {
    keywords: ["grocer", "fruit", "vegetable", "grain", "dairy", "egg", "beverage", "snack", "oil", "food", "drink"],
    images: [
      IMAGE_PLACEHOLDERS.groceries,
      UNSPLASH("photo-1547592180-85f173990554"),
      UNSPLASH("photo-1546549032-9571cd6b27df"),
    ],
  },
  {
    keywords: ["furniture", "living", "bedroom", "dining", "nursery", "office", "home", "kitchen"],
    images: [
      IMAGE_PLACEHOLDERS.home,
      UNSPLASH("photo-1600210492486-724fe5c67fb0"),
      UNSPLASH("photo-1600607687939-ce8a6c25118c"),
    ],
  },
  {
    keywords: ["beauty", "cosmetic", "skin", "hair", "wellness", "vitamin", "medicine", "health", "nutrition"],
    images: [IMAGE_PLACEHOLDERS.beauty, UNSPLASH("photo-1596462502278-27bfdc403348")],
  },
  {
    keywords: ["fitness", "gym", "sport", "outdoor"],
    images: [IMAGE_PLACEHOLDERS.fitness, UNSPLASH("photo-1517836357463-d25dfeac3438")],
  },
  {
    keywords: ["book", "stationery", "school", "supply"],
    images: [IMAGE_PLACEHOLDERS.books, UNSPLASH("photo-1544947950-fa07a98d237f")],
  },
  {
    keywords: ["car", "tyre", "tire", "tool", "construction", "electrical", "plumbing", "hardware"],
    images: [IMAGE_PLACEHOLDERS.automotive, UNSPLASH("photo-1503376780353-7e6692767b70")],
  },
  {
    keywords: ["pet", "dog", "cat"],
    images: [IMAGE_PLACEHOLDERS.pets, UNSPLASH("photo-1583337130417-3346a1be7dee")],
  },
  {
    keywords: ["appliance", "fridge", "stove", "microwave"],
    images: [IMAGE_PLACEHOLDERS.appliances, IMAGE_PLACEHOLDERS.home],
  },
  {
    keywords: ["baby", "children", "kid", "toy"],
    images: [IMAGE_PLACEHOLDERS.general, IMAGE_PLACEHOLDERS.fashion],
  },
];

const ALL_PRODUCT_IMAGES = Array.from(new Set([
  ...Object.values(IMAGE_PLACEHOLDERS),
  ...CATEGORY_GROUPS.flatMap((group) => group.images),
  UNSPLASH("photo-1598327105666-5b89351aff97"),
  UNSPLASH("photo-1592899677977-9c10ca588bbd"),
  UNSPLASH("photo-1498050108023-c5249f4df085"),
  UNSPLASH("photo-1519389950473-47ba0277781c"),
  UNSPLASH("photo-1483985988355-763728e1935b"),
  UNSPLASH("photo-1529139574466-a303027c1d8b"),
  UNSPLASH("photo-1543163521-1bf539c55dd2"),
  UNSPLASH("photo-1616486338812-3dadae4b4ace"),
  UNSPLASH("photo-1615874694520-474822394e73"),
  UNSPLASH("photo-1495446815901-a7297e633e8d"),
  UNSPLASH("photo-1492144534655-ae79c964c9d7"),
  UNSPLASH("photo-1461896836934-ffe607ba8211"),
  UNSPLASH("photo-1519389950473-47ba0277781c", 1200),
  UNSPLASH("photo-1523275335684-37898b6baf30", 1200),
  UNSPLASH("photo-1600607687939-ce8a6c25118c", 1200),
]));

const SHOP_COVER_IMAGES = [
  IMAGE_PLACEHOLDERS.market,
  IMAGE_PLACEHOLDERS.general,
  IMAGE_PLACEHOLDERS.groceries,
  IMAGE_PLACEHOLDERS.fashion,
  IMAGE_PLACEHOLDERS.home,
];

function seedHash(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function shopImagePlaceholder(
  seed?: string | null,
  kind: "cover" | "profile" = "cover",
  exclude: string[] = []
): string {
  const preferredImages = kind === "cover"
    ? SHOP_COVER_IMAGES
    : [IMAGE_PLACEHOLDERS.fashion, IMAGE_PLACEHOLDERS.phones, IMAGE_PLACEHOLDERS.home, IMAGE_PLACEHOLDERS.groceries];
  const images = [...preferredImages, ...ALL_PRODUCT_IMAGES.filter((image) => !preferredImages.includes(image))];
  const start = seedHash(seed || "shop") % images.length;
  for (let offset = 0; offset < images.length; offset += 1) {
    const image = images[(start + offset) % images.length];
    if (!exclude.includes(image)) return image;
  }
  return images[start];
}

/** Stable category-aware image selection so nearby products do not all look alike. */
export function productPlaceholder(
  category?: string | null,
  seed?: string | null,
  exclude: string[] = []
): string {
  const value = (category || "").toLowerCase();
  const group = CATEGORY_GROUPS.find((entry) =>
    entry.keywords.some((keyword) => value.includes(keyword))
  );
  const preferredImages = group?.images || [IMAGE_PLACEHOLDERS.general, IMAGE_PLACEHOLDERS.market];
  const images = [...preferredImages, ...ALL_PRODUCT_IMAGES.filter((image) => !preferredImages.includes(image))];
  const key = seed || value || "product";
  const start = seedHash(key) % images.length;
  for (let offset = 0; offset < images.length; offset += 1) {
    const image = images[(start + offset) % images.length];
    if (!exclude.includes(image)) return image;
  }
  return images[start];
}

/** Avatar image for a user who has not uploaded one. */
export function userAvatarPlaceholder(firstName?: string | null, lastName?: string | null): string {
  const name = `${firstName || ""} ${lastName || ""}`.trim() || "Pakalale User";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=002583&color=FFB800&bold=true&size=200`;
}
