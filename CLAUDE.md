@AGENTS.md

# Pakalale Marketplace

Local-market trading platform: a public storefront (products, cart, wishlist, checkout), a community feed, buyer–seller chat with "deals", and dashboards for customers, shop owners and admins. Next.js 16 App Router + React 19, MongoDB via Mongoose, Socket.IO for realtime, Cloudinary for media, Tailwind v4 + shadcn (`base-nova` style on `@base-ui/react`).

Next.js 16 differs from older versions. Read `node_modules/next/dist/docs/` before using a Next API you are unsure of. One example: route middleware lives in `src/proxy.ts` and exports `proxy`, not `middleware`.

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

- `src/lib/sessionToken.ts`: HS256 JWT in the httpOnly cookie `pakalale-session` (30 days). It does not touch the DB, so it is safe to import from the proxy and the socket server.
- `src/lib/session.ts`: `setSessionCookie` / `clearSessionCookie`, `getSessionUser` (re-reads role from DB and rejects tokens issued before `passwordChangedAt`), and `requireSession(request, { roles?, actingAs? })`. That last one is the guard every protected API route uses:
  ```ts
  const auth = await requireSession(request, { roles: ["shop_owner"], actingAs: body.userId });
  if (auth.response) return auth.response;   // 401 AUTH_REQUIRED / 403 FORBIDDEN
  const { user } = auth;
  ```
  `actingAs` exists because older clients send their own user id. It must match the session (admins are exempt). Never trust a user id from the request body or query by itself.
- `src/proxy.ts` redirects signed-out visitors away from `/customer`, `/shop` and `/admin` to `/login?next=…`. It checks the cookie only. API routes still enforce auth themselves.
- Email verification and password reset use `src/lib/authTokens.ts`: random tokens, only the SHA-256 hash is stored. Routes are under `src/app/api/auth/*`.
- Google sign-in (`src/lib/google.ts`) is a server-side OAuth code flow with state, PKCE and a nonce. `GET /api/auth/google?next=` stores those values in the `pakalale-google` cookie and redirects to Google. Google sends the user back to `GET /api/auth/google/callback`, the callback URI registered with Google. The callback links the Google account by `googleId` or by email; if that address was never verified, it drops the existing password. A new user becomes a `customer`. Then it sets the session cookie and redirects to `/login?google=done`, which loads the user from `/api/auth/me` into the store. Google-only users have no `password`.
- Client side: `src/store/authStore.ts` (Zustand, persisted as `auth-storage`) holds the client user (`toClientUser` in `src/lib/authUser.ts`). `validateSession()` checks `/api/auth/me`. `logout()` calls `/api/auth/logout`, because only the server can clear the cookie.
- Roles: `customer`, `shop_owner`, `admin`. After login, customers go to `/customer`, shop owners to `/shop/feed`, admins to `/admin`. `src/lib/authRedirect.ts` builds `next=` links.

### Routes (`src/app`)

Route groups in parentheses do not appear in URLs.

- `(store)`: public storefront at `/`, plus `/feed`, `/cart`, `/checkout`, `/saved`. Guests can browse. Cart and wishlist live in persisted Zustand stores (`cartStore`, `wishlistStore`).
- `(auth)`: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, built on `components/auth/AuthShell`.
- `(dashboard)`: `/customer/*` and `/shop/*`. The layout validates the session, redirects to login and opens the global socket (`useGlobalSocket`).
- `(admin)`: `/admin`, `/admin/users`, `/admin/shops`.
- `api/`: REST route handlers (`route.ts`). `feed/v2` and `search/v2` are the versions current clients use. The v1 routes remain.

`PROJECT_DOCUMENTATION.md` has a page-by-page table, but parts of it are outdated (it lists `/customer/deals`, for example).

### Data (`src/models`)

Mongoose models: User, Shop, Product, Order, Message (exports `Chat` too), FeedPost (also exports `Location`), FeedEvent, Notification, Review, DemandRecord, SearchHistory, ProductView, ShopView, NewsletterSubscriber. `connectToDatabase()` in `src/lib/mongodb.ts` caches the connection on `global` and imports models so `populate()` works. Call it at the top of every route handler. Helpers include `lib/notifications.ts` (creates notifications), `lib/cloudinary.ts` + `api/upload` + `hooks/useUpload.ts` (media), and `lib/product.ts`.

API conventions: return `NextResponse.json({ error, code? }, { status })` on failure, and escape user input before using it in a `$regex` (see `api/products`). Checkout recomputes prices and stock on the server. It only applies promotions set by the shop owner. Never trust client prices.

### Client

- Data fetching: `src/hooks/useApi.ts` (in-memory stale-while-revalidate cache with request dedupe) and `useCountPolling`. Realtime goes through `useSocket` / `useGlobalSocket`.
- State: Zustand stores in `src/store/` (auth, cart, wishlist, deals, notifications, online presence, typing).
- UI: shadcn primitives in `src/components/ui/`, storefront pieces in `src/components/landing/`, feature components at the top of `src/components/`. Icons come from lucide-react, animation from framer-motion, toasts from react-hot-toast, and forms use react-hook-form + zod.
- Theme: light is the default. Dark mode uses the `.dark` class. `src/lib/theme.ts` holds the storage key `pakalale-theme` and an inline init script loaded in `app/layout.tsx`. Colour tokens live in `src/app/globals.css`. Use the existing palette: mustard `#ffb800` and brand blue `#002583`.
- Path alias: `@/*` → `src/*`.

## Deployment

A push to `main` triggers `.github/workflows/deploy.yml`, which SSHes into EC2, runs `git pull`, then `docker build` and `docker run -p 80:3000 --env-file .env`. The Dockerfile copies the full `.next` + `src` and runs `npx tsx server.ts` (not standalone output). `deploy/deploy.sh`, `deploy/nginx.conf` and `ecosystem.config.cjs` cover the PM2 + nginx setup. See `DEPLOY.md`.

## Conventions

- Commit messages are 1–2 lines, with no `Co-Authored-By` trailer.
- Write comments that explain *why*, as the existing code does.
