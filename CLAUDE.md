@AGENTS.md

# Pakalale Marketplace

Local-market trading platform: a public storefront (products, cart, wishlist, checkout), a community feed, buyer–seller chat with "deals", and dashboards for customers, shop owners and admins. Next.js 16 App Router + React 19, MongoDB via Mongoose, Socket.IO for realtime, Cloudinary for media, Tailwind v4 + shadcn (`base-nova` style on `@base-ui/react`).

Next.js 16 differs from older versions. Read `node_modules/next/dist/docs/` before using a Next API you are unsure of. There is no route middleware file (`proxy.ts`); auth gating is done in the route-group layouts and in each API route via `requireSession`.

## Commands

```bash
npm run dev          # tsx server.ts — custom HTTP server + Socket.IO + Next (dev)
npm run build        # next build
npm start            # tsx server.ts with the production build
npm run lint         # eslint
npx tsc --noEmit     # type check (CI runs this, then build)
npx tsx scripts/<name>.ts   # one-off DB scripts: ensure-indexes, cleanup-duplicate-chats, migrate-images, bench-api
```

There is no test suite. CI (`.github/workflows/test.yml`) runs type check and build only.

**The local `.env` points at a shared MongoDB Atlas cluster.** Do not run scripts, seeders or flows that write data against it unless the user asks.

## Environment

`.env` is loaded by `server.ts` (`dotenv`, override). Variables used:

- `MONGODB_URI` (falls back to `mongodb://localhost:27017/pakalale`)
- `NEXTAUTH_SECRET` signs the session JWT. Required; `sessionToken.ts` throws without it.
- `NEXTAUTH_URL` / `APP_URL` are the base URL for email links.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` for uploads.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` are optional. Without SMTP, dev prints email links to the server log, and production skips email verification (`src/lib/email.ts`).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` turn on "Continue with Google". Without them, the button sends people back to `/login` with a message.
- `PORT`, `HOSTNAME`

## Architecture

### Server

`server.ts` is the entry point in every environment. It wraps Next's request handler in a Node HTTP server and attaches Socket.IO on the same port. Socket auth reuses the session cookie. Events: `register`, `join_chat` (participants only), `send_message`, `typing`/`stop_typing`, `deal_status_changed`, plus online presence. Online state is held in memory, so the app must run as **one process** (PM2 `instances: 1`, single Docker container). The rate limiter (`src/lib/rateLimit.ts`) and API cache (`src/lib/cache.ts`) also rely on that. Vercel cannot run `server.ts`, so realtime does not work there.

### Auth (custom; NextAuth has been removed)

- `src/lib/sessionToken.ts`: HS256 JWT in the httpOnly cookie `pakalale-session` (30 days). It does not touch the DB, so it is safe to import from layouts and the socket server.
- `src/lib/session.ts`: `setSessionCookie` / `clearSessionCookie`, `getSessionUser` (re-reads role from DB and rejects tokens issued before `passwordChangedAt`), and `requireSession(request, { roles?, actingAs? })`. That last one is the guard every protected API route uses:
  ```ts
  const auth = await requireSession(request, { roles: ["shop_owner"], actingAs: body.userId });
  if (auth.response) return auth.response;   // 401 AUTH_REQUIRED / 403 FORBIDDEN
  const { user } = auth;
  ```
  `actingAs` exists because older clients send their own user id. It must match the session (admins are exempt). Never trust a user id from the request body or query by itself.
- There is no `src/proxy.ts`. Signed-out visitors are redirected to `/login` by the route-group layouts (`(dashboard)`, and the nested `customer`/`shop` layouts, plus `(admin)`), which check the session store; API routes still enforce auth themselves with `requireSession`.
- Email verification and password reset use `src/lib/authTokens.ts`: random tokens, only the SHA-256 hash is stored. Routes are under `src/app/api/auth/*`.
- Google sign-in (`src/lib/google.ts`) is a server-side OAuth code flow with state, PKCE and a nonce. `components/auth/GoogleButton` opens `GET /api/auth/google?mode=popup&next=` in a **popup**, so the main tab's history never contains Google's pages. The callback (`/api/auth/google/callback`, the URI registered with Google) links the Google account by `googleId` or by email; if that address was never verified, it drops the existing password. A new user becomes a `customer`. The callback then sets the session cookie and sends the popup to `/google-done`, which reports to the opening tab over a `BroadcastChannel` (plus `postMessage`) and closes. The opening tab loads the user from `/api/auth/me` and calls `router.replace` to the return page. If popups are blocked, the button falls back to a full-page redirect, and the callback lands on `/login?google=done`. Google-only users have no `password`.
- After any sign-in, `returnTarget(next)` in `src/lib/authRedirect.ts` uses an explicit `?next=` or a page saved by a "sign in to continue" button; otherwise the user goes to their role's dashboard (`homeForRole`). The last public/customer page is used only by the auth Back button, not as an implicit login destination. `safeNextPath` allows only internal paths and rejects sign-in pages, `/api/` and the account landing page `/` (exact match, never a prefix). Every hand-off uses `router.replace`, so Back never returns to `/login`. `/login` and `/signup` are guest-only and send signed-in people to their role's dashboard. `validateSession()` also restores a session from the cookie when nothing is stored in the browser.
- Client side: `src/store/authStore.ts` (Zustand, persisted as `auth-storage`) holds the client user (`toClientUser` in `src/lib/authUser.ts`). `validateSession()` checks `/api/auth/me`. `logout()` calls `/api/auth/logout`, because only the server can clear the cookie.
- Roles: `customer`, `shop_owner`, `admin`. After login, customers go to `/customer`, shop owners to `/shop/feed`, admins to `/admin`. `src/lib/authRedirect.ts` builds `next=` links.

### Routes (`src/app`)

Route groups in parentheses do not appear in URLs.

- `(landing)`: public marketplace. `/` (`Storefront`: hero, `FilterPanel`, product grid, live `CartPanel`; filters are URL params), `/cart`, `/saved`, `/feed`. Everyone, signed in or not, uses these. Layout is `StoreLayout` (`components/landing/StoreHeader`, `Footer`, cart/wishlist sheets). Store UI and assets live in `src/components/landing/`. The public checkout lives at `/customer/checkout` (account area); guests are prompted to sign in first and then land on their account. Authenticated visitors are redirected to their own account area, so the landing frame never hosts a checkout.
- `(auth)`: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/google-done`. These stand alone, with no site header or footer, inside `components/auth/AuthShell`. Its Back button returns to the last landing page, which the landing layout saves in sessionStorage (`rememberSitePage` / `lastSitePage` in `src/lib/authRedirect.ts`).
- `(dashboard)`: shared layout (`DashboardLayout`) handles session validation and role redirects for both customers and shop owners.
  - `/customer/*`: customer area. Nested `customer/layout.tsx` gates on the session. Pages: overview, `cart`, `checkout`, `orders`, `orders/[orderId]`, `saved`, `settings`, `chat`, `notifications`, `locations`, `locations/[locationId]`, `search`, `profile/[userId]`. Account pages use `components/customer/CustomerTopBar` (hidden on home/account pages) plus page-level headers; there is no shared `AccountShell`.
  - `/shop/*`: seller dashboard (`ShopNav`/`ShopBottomNav`). Nested `shop/layout.tsx` gates on `shop_owner`/`admin`. Pages: `feed`, `overview`, `products`, `orders`, `analytics`, `sales`, `history`, `chat`, `notifications`, `settings`, `profile/[userId]`, `virtual-shop`.
- `(admin)`: `/admin/*` (dashboard, shops, users). Its own layout with sidebar; logo and "View store" link go to `/`.
- `api/`: REST route handlers (`route.ts`). `feed/v2` and `search/v2` are the versions current clients use. The v1 routes remain. `api/products/facets` returns the filter-panel counts; `api/user/addresses` manages saved addresses.

`PROJECT_DOCUMENTATION.md` has a page-by-page table, but parts of it are outdated.

### Data (`src/models`)

Mongoose models: User, Shop, Product, Order, Message (exports `Chat` too), FeedPost (also exports `Location`), FeedEvent, Notification, Review, DemandRecord, SearchHistory, ProductView, ShopView, NewsletterSubscriber. `connectToDatabase()` in `src/lib/mongodb.ts` caches the connection on `global` and imports models so `populate()` works. Call it at the top of every route handler. Helpers include `lib/notifications.ts` (creates notifications), `lib/cloudinary.ts` + `api/upload` + `hooks/useUpload.ts` (media), and `lib/product.ts`.

API conventions: return `NextResponse.json({ error, code? }, { status })` on failure, and escape user input before using it in a `$regex` (see `api/products`). Checkout recomputes prices and stock on the server. It only applies promotions set by the shop owner. Never trust client prices. Delivery options and fees live in `src/lib/delivery.ts`. Each order belongs to one shop and carries one delivery fee: the server stores `subtotal`, `deliveryMethod`, `deliveryFee`, and `total = subtotal + deliveryFee`. It also copies the delivery details into `notes`, because the seller order screen shows notes.

### Client

- Data fetching: `src/hooks/useApi.ts` (in-memory stale-while-revalidate cache with request dedupe) and `useCountPolling`. Realtime goes through `useSocket` / `useGlobalSocket`.
- State: Zustand stores in `src/store/` (auth, cart with the chosen `delivery`, wishlist, deals, notifications, online presence, typing).
- UI: shadcn primitives in `src/components/ui/`, public-storefront pieces in `src/components/landing/`, customer area pieces in `src/components/customer/`, feature components at the top of `src/components/`. Icons come from lucide-react, animation from framer-motion, toasts from react-hot-toast, and forms use react-hook-form + zod.
- Theme: light is the default. Dark mode uses the `.dark` class. `src/lib/theme.ts` holds the storage key `pakalale-theme` and an inline init script loaded in `app/layout.tsx`. Colour tokens live in `src/app/globals.css`. Use the existing palette: mustard `#ffb800` and brand blue `#002583`.
- Path alias: `@/*` → `src/*`.

## Deployment

A push to `main` triggers `.github/workflows/deploy.yml`, which SSHes into EC2, runs `git pull`, then `docker build` and `docker run -p 80:3000 --env-file .env`. The Dockerfile copies the full `.next` + `src` and runs `npx tsx server.ts` (not standalone output). `deploy/deploy.sh`, `deploy/nginx.conf` and `ecosystem.config.cjs` cover the PM2 + nginx setup. See `DEPLOY.md`.

## Conventions

- Commit messages are 1–2 lines, with no `Co-Authored-By` trailer.
- Write comments that explain *why*, as the existing code does.
