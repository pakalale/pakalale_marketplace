/**
 * Shop opening hours helpers.
 *
 * Hours are stored in two possible formats:
 *  - String: "08:00 - 18:00" (from settings form)
 *  - Object: { open: "08:00", close: "18:00", closed: false } (from model)
 * The storefront and settings both need one predictable shape, with sensible
 * defaults for shops that never filled their hours in.
 */

export interface ShopDayHours {
  open: string;
  close: string;
  closed: boolean;
}

export const SHOP_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type ShopDay = (typeof SHOP_DAYS)[number];

/** Used when a shop has not set hours for a day. */
export const DEFAULT_SHOP_HOURS: Record<ShopDay, ShopDayHours> = {
  monday: { open: "08:00", close: "18:00", closed: false },
  tuesday: { open: "08:00", close: "18:00", closed: false },
  wednesday: { open: "08:00", close: "18:00", closed: false },
  thursday: { open: "08:00", close: "18:00", closed: false },
  friday: { open: "08:00", close: "19:00", closed: false },
  saturday: { open: "09:00", close: "19:00", closed: false },
  sunday: { open: "10:00", close: "15:00", closed: false },
};

/** Parse a "HH:MM - HH:MM" string into { open, close }. */
function parseRange(value: string): { open: string; close: string } | null {
  const cleaned = value.replace(/[–\u2014–—]/g, "-");
  const [open, close] = cleaned.split("-").map((part) => part.trim());
  if (!open || !close) return null;
  return { open, close };
}

/**
 * Parse hours from either string or object format into a consistent
 * { open, close, closed } shape. Returns defaults when the value is missing
 * or unparseable.
 */
export function parseDayHours(
  raw: unknown,
  fallback: ShopDayHours
): ShopDayHours {
  if (typeof raw === "string") {
    const range = parseRange(raw);
    return range
      ? { open: range.open, close: range.close, closed: false }
      : fallback;
  }

  if (raw && typeof raw === "object") {
    const value = raw as Partial<ShopDayHours>;
    return {
      open: typeof value.open === "string" && value.open.trim() ? value.open : fallback.open,
      close: typeof value.close === "string" && value.close.trim() ? value.close : fallback.close,
      closed: Boolean(value.closed),
    };
  }

  return fallback;
}

/**
 * Always returns all seven days in week order, filling anything missing or
 * malformed with the default opening times.
 */
export function normalizeShopHours(
  hours?: Record<string, unknown> | null
): Array<{ day: ShopDay } & ShopDayHours> {
  return SHOP_DAYS.map((day) => {
    const fallback = DEFAULT_SHOP_HOURS[day];
    const raw = hours?.[day];
    return { day, ...parseDayHours(raw, fallback) };
  });
}

/**
 * Convert the hours object from the settings form (strings) into the format
 * the Shop model expects (objects with open/close/closed). Used when saving.
 *
 * `closedDays` lets a shop take a day off; a day with no hours typed in is
 * treated as closed too, so clearing a day never silently reopens it.
 */
export function toModelHours(
  formHours: Record<string, string>,
  closedDays?: Record<string, boolean>
): Record<string, { open: string; close: string; closed: boolean }> {
  const result: Record<string, { open: string; close: string; closed: boolean }> = {};
  for (const day of SHOP_DAYS) {
    const raw = formHours[day] || "";
    const range = parseRange(raw);
    const fallback = DEFAULT_SHOP_HOURS[day];
    result[day] = range && !closedDays?.[day]
      ? { open: range.open, close: range.close, closed: false }
      : { open: fallback.open, close: fallback.close, closed: true };
  }
  return result;
}
