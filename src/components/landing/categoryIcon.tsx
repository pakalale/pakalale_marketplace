import {
  Baby,
  Bike,
  BookOpen,
  Camera,
  Car,
  Coffee,
  Dumbbell,
  Footprints,
  Gamepad2,
  Gem,
  Glasses,
  Headphones,
  HeartPulse,
  Home,
  Laptop,
  Monitor,
  Paintbrush,
  PawPrint,
  Scissors,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tv,
  Utensils,
  Watch,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const RULES: Array<{ match: string[]; icon: LucideIcon }> = [
  // Checked first so "Pet Accessories" is not treated as jewellery.
  { match: ["pet", "animal", "paw"], icon: PawPrint },
  { match: ["phone", "mobile", "tablet"], icon: Smartphone },
  { match: ["laptop", "computer", "pc", "macbook"], icon: Laptop },
  { match: ["monitor", "screen", "display"], icon: Monitor },
  { match: ["audio", "headphone", "speaker", "earbud", "music"], icon: Headphones },
  { match: ["tv", "television", "electronic"], icon: Tv },
  { match: ["camera", "photo", "video"], icon: Camera },
  { match: ["game", "gaming", "console"], icon: Gamepad2 },
  { match: ["watch", "wearable"], icon: Watch },
  { match: ["fashion", "cloth", "shirt", "apparel", "wear"], icon: Shirt },
  { match: ["shoe", "sneaker", "footwear", "boot"], icon: Footprints },
  { match: ["bag", "wallet", "handbag", "luggage"], icon: ShoppingBasket },
  { match: ["beauty", "health", "makeup", "skin", "care"], icon: Sparkles },
  { match: ["jewel", "gold", "gem"], icon: Gem },
  { match: ["glass", "eyewear", "optic"], icon: Glasses },
  { match: ["home", "kitchen", "furniture", "cook", "decor"], icon: Home },
  { match: ["kitchen", "utensil", "pot", "plate"], icon: Utensils },
  { match: ["coffee", "tea", "drink"], icon: Coffee },
  { match: ["food", "grocery", "market", "fresh"], icon: ShoppingBasket },
  { match: ["sport", "outdoor", "fitness", "gym"], icon: Dumbbell },
  { match: ["bike", "cycle", "motor"], icon: Bike },
  { match: ["car", "auto", "vehicle", "spare"], icon: Car },
  { match: ["baby", "kid", "toy", "child"], icon: Baby },
  { match: ["book", "stationery", "school", "office"], icon: BookOpen },
  { match: ["tool", "hardware", "repair", "wrench"], icon: Wrench },
  { match: ["paint", "art", "craft"], icon: Paintbrush },
  { match: ["hair", "salon", "barber", "scissor"], icon: Scissors },
  { match: ["health", "pharmacy", "medical"], icon: HeartPulse },
];

export function getCategoryIcon(category: string): LucideIcon {
  const value = category.toLowerCase();
  for (const rule of RULES) {
    if (rule.match.some((keyword) => value.includes(keyword))) return rule.icon;
  }
  return ShoppingBasket;
}
