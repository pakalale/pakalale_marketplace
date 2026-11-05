export type Theme = "light" | "dark";

/** localStorage key used by the inline script and ThemeProvider. */
export const THEME_STORAGE_KEY = "pakalale-theme";

/** The Pakalale light theme is the product default. */
export const DEFAULT_THEME: Theme = "light";

export const THEMES: Theme[] = ["light", "dark"];

/**
 * Runs before first paint (inlined in <head>) so the stored theme is applied
 * without a flash of the wrong colours. Mirrors ThemeProvider.applyTheme.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var theme = stored === "dark" ? "dark" : "light";
    var root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;
