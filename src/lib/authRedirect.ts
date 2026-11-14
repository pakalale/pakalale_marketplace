/** Default landing page for each role after signing in. */
export function homeForRole(role?: string) {
  if (role === "admin") return "/admin";
  if (role === "shop_owner") return "/shop/feed";
  return "/customer";
}

/** Only same-site paths, so a crafted ?next= cannot send people off-site. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login") || value.startsWith("/signup")) return null;
  return value;
}

/**
 * Where to go after sign-in: the page the person was heading to, unless it
 * belongs to another role's area, in which case their own home.
 */
export function destinationAfterLogin(role: string, requested: string | null | undefined) {
  const next = safeNextPath(requested);
  if (!next) return homeForRole(role);
  const area = next.startsWith("/admin") ? "admin" : next.startsWith("/shop") ? "shop_owner" : next.startsWith("/customer") ? "customer" : null;
  if (area && area !== role) return homeForRole(role);
  return next;
}

/** Remembers where to return after signing in (used by buttons that need an account). */
export function rememberReturnPath(path: string) {
  try {
    sessionStorage.setItem("redirectAfterLogin", path);
  } catch {
    /* storage unavailable: the person lands on their home page instead */
  }
}

export function takeReturnPath() {
  try {
    const value = sessionStorage.getItem("redirectAfterLogin");
    sessionStorage.removeItem("redirectAfterLogin");
    return value;
  } catch {
    return null;
  }
}

/** Login URL that brings the person back to `path` afterwards. */
export function loginHref(path: string) {
  return `/login?next=${encodeURIComponent(path)}`;
}

const SITE_PAGE_KEY = "lastSitePage";

/** Called by the site layout on every page, so sign-in's Back knows where to go. */
export function rememberSitePage(path: string) {
  try {
    sessionStorage.setItem(SITE_PAGE_KEY, path);
  } catch {
    /* storage unavailable: Back falls back to the home page */
  }
}

/** The last store or account page visited in this tab, if any. */
export function lastSitePage() {
  try {
    return safeNextPath(sessionStorage.getItem(SITE_PAGE_KEY));
  } catch {
    return null;
  }
}
