/** Default landing page for each role after signing in. */
export function homeForRole(role?: string) {
  if (role === "admin") return "/admin";
  if (role === "shop_owner") return "/shop/feed";
  return "/customer";
}

/** Sign-in steps and endpoints are never a place to return to. */
const NOT_A_DESTINATION = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/google-done", "/api/"];

/** Only same-site paths, so a crafted ?next= cannot send people off-site. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (NOT_A_DESTINATION.some((prefix) => value.startsWith(prefix))) return null;
  return value;
}

/**
 * Where to go after sign-in: the page the person came from, or the store if
 * none was recorded. A page in another role's area (e.g. a buyer heading to
 * /shop) sends them to their own area instead.
 */
export function destinationAfterLogin(role: string, requested: string | null | undefined) {
  const next = safeNextPath(requested);
  if (!next) return "/";
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

/** Reads the saved destination without clearing it. */
export function peekReturnPath() {
  try {
    return safeNextPath(sessionStorage.getItem("redirectAfterLogin"));
  } catch {
    return null;
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

/**
 * The page to return to after signing in: an explicit ?next=, then a page a
 * "sign in to continue" button saved, then the last store page this tab saw.
 */
export function returnTarget(next: string | null | undefined) {
  return safeNextPath(next) ?? peekReturnPath() ?? lastSitePage();
}
