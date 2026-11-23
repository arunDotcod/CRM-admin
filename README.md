# Dotcod Admin (`CRM-admin`)

Back office for Dotcod staff (Slice BO, billing phase 1). Staff verify signups, assign
subscriptions, create customers, manage staff and settings, and track usage. It is a separate app
from the customer portal (`CRM-Dotcod-AI`) with its own accounts (`platform_staff`), password +
mandatory TOTP, its own JWT and refresh cookie, and only the `/api/v1/admin/*` API
(`architecture/api-contracts.md` §12).

Stack: same as the portal: Next.js 15.5, React 18.3, Tailwind 3.4 + shadcn/Radix primitives
(copied from the portal, `components/ui/*`), lucide icons, sonner toasts, JS/JSX with the `@/`
alias. Accent: amber on a dark sidebar plus a "Dotcod Admin · Staff only" badge, so it never
looks like the indigo customer portal.

## Status (BO16)

Built: login (password → TOTP verify, or first-time TOTP enrolment with QR + key), `/setup?token=…`
(one-time setup link: password, then TOTP enrolment), protected app shell with permission-based
sidebar and user menu, API client with refresh, staff auth context.

**BO17:** Home (counter tiles that link to a pre-filtered Customers list, pending queue) and
Customers (debounced search, filters in the URL query string, sort, cursor "Load more", CSV
export). Shared pieces: `components/customers/status-badge.jsx` (one colour per verification /
entitlement state), `usage-meter.jsx` (used / limit bar, amber at 80 %, red at 100 %),
`customer-table.jsx`, `components/common/states.jsx`; URL ↔ filter helpers in `lib/customers.js`;
`apiDownload()` in `lib/api.js` for the CSV. Local test data:
`CRM-backend-server/scripts/seed-bo17-admin-customers.ts` (slug prefix `bo17-seed-`, `--reset` /
`--remove`).

Placeholders (right titles, routes and permission checks; filled later): Customer detail `/customers/[id]` (BO18), Staff and Audit log (BO19), New customer
`/customers/new` and Settings (BO28).

## Layout

| Path | What |
| --- | --- |
| `lib/api.js` | Admin API client: `api(path)` relative to `/api/v1/admin`, credentials included, one refresh + retry on 401 via `/auth/refresh` (shared in-flight refresh), `ApiError { status, code, details, reason }`, human error copy; `staffAuth.*` for §12.1 |
| `lib/auth.js` | `AuthProvider` / `useAuth()`: `status`, `me`/`staff`, `role`, `permissions`, `can(perm)`, `login`, `setupAccount`, `completeTotp`, `logout`, `reload`; restores the session from the refresh cookie on load; re-checks `/auth/me` on tab focus (≤ 1/min) |
| `lib/nav.js` | Sidebar items and the permission each needs |
| `components/auth/totp-step.jsx` | TOTP enrol / verify step shared by `/login` and `/setup` |
| `components/shell/*` | App shell, admin badge, `PageHeader`, `ComingSoon`, `RequirePermission` |
| `app/login`, `app/setup` | Public sign-in screens |
| `app/(app)/*` | Protected routes (redirect to `/login?next=…` without a session) |
| `scripts/dev-api.mjs` | Local only: runs the backend with the admin API on (see below) |
| `scripts/totp-code.mjs` | Local only: prints the current TOTP code for the local test account |

Navigation by permission (the API enforces the same on every route):

| Item | Permission | Roles |
| --- | --- | --- |
| Home, Customers | `admin.customers.read` | all |
| New customer button | `admin.customers.verify` | SUPER_ADMIN, OPS |
| Audit log | `admin.audit.read` | SUPER_ADMIN, OPS |
| Staff | `admin.staff.manage` | SUPER_ADMIN |
| Settings | `admin.settings.manage` | SUPER_ADMIN |

## Environment

`CRM-admin` (`.env.local`, see `.env.example`):

| Var | Default | Notes |
| --- | --- | --- |
| `API_PROXY_TARGET` | `http://127.0.0.1:4100` | Nest API origin for the `/api/v1/admin/*` rewrite in `next.config.js` (server side). |
| `NEXT_PUBLIC_API_ORIGIN` | unset | Leave unset: the browser calls same-origin `/api/v1/admin`, so the `SameSite=Strict` refresh cookie stays first-party. |
| `NEXT_DIST_DIR` | `.next` | Separate build folder while a dev server runs. |

Backend (`CRM-backend-server/.env`): the admin API is off (every `/admin/*` → 404) unless both of
these are set:

| Var | Notes |
| --- | --- |
| `ADMIN_PORTAL_ORIGIN` | Exactly this app's origin (`http://127.0.0.1:8090` locally). Other `Origin`s get `ORIGIN_NOT_ALLOWED`. Also the base of setup links unless `ADMIN_PORTAL_URL` is set. |
| `ADMIN_JWT_SECRET` | ≥ 32 chars, different from every other secret. |
| `ADMIN_COOKIE_PATH` | Default `/api/v1/admin/auth`; add the proxy prefix when the API sits under `/rest`. |
| `CHANNEL_SECRET_KEYS`, `CHANNEL_SECRET_ACTIVE_KID` | TOTP secrets are encrypted with this keyring; without it enrolment fails. |

The shared local backend `.env` has `ADMIN_PORTAL_ORIGIN` but no `ADMIN_JWT_SECRET` or keyring, so
use `npm run dev:api` locally (next section).

## Run locally

```bash
npm install
```

1. Start an admin-enabled API on `:4150`. The first run writes dev-only secrets to
   `.local/admin-api.env` (gitignored; keep it, the local staff TOTP secrets are encrypted with it):

   ```bash
   npm run dev:api
   ```

2. Point the app at it (`.env.local`: `API_PROXY_TARGET=http://127.0.0.1:4150`) and start it on
   `http://127.0.0.1:8090`:

   ```bash
   npm run dev
   ```

   In the Claude desktop app, the root `.claude/launch.json` has `admin-api` and `admin` entries
   for the browser pane.

3. Create a staff member (prints a one-time setup link, valid 72 h). `platform_staff` is
   platform-only under RLS, so run it with the platform database URL:

   ```bash
   cd ../CRM-backend-server
   DATABASE_URL="$PLATFORM_DATABASE_URL" RLS_MODE=off ADMIN_PORTAL_ORIGIN=http://127.0.0.1:8090 yarn admin:create-staff you@dotcod.in "Your Name"
   ```

   Open the link, set a password (12+ characters), scan the QR code with an authenticator app and
   enter the code. A local SUPER_ADMIN test account already exists; its details are in
   `.local/test-staff.md` (gitignored), and `node scripts/totp-code.mjs` prints its current code.

## Build

```bash
npm run build
```

```bash
npm start
```

`output: 'standalone'`, like the portal. Hosting (`demo-admin.dotcod.in`, PM2 `dotcod-admin`,
nginx `/rest/api/v1/admin/*` → backend) is BO21.

## Auth flow (api-contracts §12.1)

1. `POST /auth/login {email, password}` → `{ stage, challengeToken, expiresIn: 300 }`.
2. `stage = totp_enrol`: `POST /auth/totp/enrol` (Bearer challenge) → `{ otpauthUrl, secret, qrSvg }`.
3. `POST /auth/totp/verify {code}` (Bearer challenge) → `{ accessToken (15 min), session, staff }` and
   the `dotcod_admin_rt` cookie (HttpOnly, SameSite=Strict, Path `/api/v1/admin/auth`).
4. On load and on any 401, `POST /auth/refresh` rotates the cookie (12-hour absolute session).
5. `POST /auth/logout` revokes the session and clears the cookie.

The access token is kept in memory only. 5 wrong codes burn a challenge; 5 failures lock the
account for 15 minutes.
