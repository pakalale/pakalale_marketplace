"use client";

import { useEffect, useState } from "react";

let ignoreScrollUntil = 0;

/**
 * Programmatic jumps (restoring a saved scroll position) are not scroll
 * gestures, so they must not hide the header or bottom nav.
 */
export function ignoreNavScrollFor(durationMs = 1200) {
  ignoreScrollUntil = Date.now() + durationMs;
}

export function useNavScrollVisibility() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastDirection: "up" | "down" | null = null;
    let directionDistance = 0;
    const directionThreshold = 14;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      if (Date.now() < ignoreScrollUntil) {
        lastDirection = null;
        directionDistance = 0;
        return;
      }

      if (currentScrollY <= 24) {
        lastDirection = null;
        directionDistance = 0;
        setVisible(true);
        return;
      }

      if (Math.abs(delta) < 1) return;

      const direction = delta > 0 ? "down" : "up";
      if (direction !== lastDirection) {
        lastDirection = direction;
        directionDistance = 0;
      }

      directionDistance += Math.abs(delta);
      if (directionDistance >= directionThreshold) {
        setVisible(direction === "up");
        directionDistance = 0;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return visible;
}