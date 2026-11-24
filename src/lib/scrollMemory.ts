"use client";

const STORAGE_KEY = "pakalale:feed-scroll";
const MAX_AGE_MS = 5 * 60 * 1000;

interface SavedFeedPosition {
  path: string;
  y: number;
  savedAt: number;
}

function read(): SavedFeedPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFeedPosition) : null;
  } catch {
    return null;
  }
}

/** Remember where the feed was scrolled before opening a post, so Back can return there. */
export function rememberFeedPosition() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        path: window.location.pathname,
        y: window.scrollY,
        savedAt: Date.now(),
      } satisfies SavedFeedPosition)
    );
  } catch {
    /* sessionStorage can be unavailable; restoring the position is optional. */
  }
}

/**
 * Take the remembered position for `path`, clearing it so it is applied once.
 * Entries older than ten minutes, or saved at the very top, are ignored.
 */
export function takeFeedPosition(path: string): number | null {
  const saved = read();
  if (!saved) return null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (saved.path !== path || saved.y <= 0) return null;
  if (Date.now() - saved.savedAt > MAX_AGE_MS) return null;
  return saved.y;
}
