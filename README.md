# Dotcod Admin (`CRM-admin`)

Back office for **Dotcod staff** (Slice BO, billing phase 1). Staff use it to verify signups,
assign and renew subscriptions (limits + dates, no payments), create customers directly, suspend
and reactivate customers, manage staff and platform settings, and read usage and audit trails.

It is a separate app from the customer portal (`CRM-Dotcod-AI`). It has its own host, its own
accounts (`platform_staff`, never customer users), password + mandatory TOTP, its own JWT
(`aud=dotcod-admin`) and refresh cookie, and it only talks to the `/api/v1/admin/*` API
(`architecture/api-contracts.md` §12).

| Environment | URL |
| --- | --- |
| Local | `http://127.0.0.1:8090` |
| Demo | `https://admin-demo-crm.dotcod.in` (portal: `https://demo-crm.dotcod.in`) |
| Production (planned) | `https://admin.dotcod.in` |

How to do day-to-day work (first SUPER_ADMIN, verifying, renewing, suspending, troubleshooting):
**`CRM-backend-server/docs/back-office-runbook.md`**.

Stack: the same as the portal. Next.js 15.5, React 18.3, Tailwind 3.4 + shadcn/Radix primitives
(`components/ui/*`), lucide icons, sonner toasts, JS/JSX with the `@/` alias. Amber accent on a
dark sidebar and a "Dotcod Admin · Staff only" badge, so it never looks like the indigo customer
portal.

## Roles

Fixed map in the backend (`src/admin/rbac/staff-permissions.ts`). The API checks every route; the
UI only hides what a role can't use.

| Role | Can |
| --- | --- |
| `SUPER_ADMIN` | Everything: customers, subscriptions, suspend, audit log, **Staff**, **Settings** |
| `OPS` | Read customers and usage, verify / reject / reopen, create customers, edit profiles, subscriptions, suspend / reactivate, audit log |
| `SUPPORT` | Read-only: Home, Customers, customer detail (all tabs) |

| Screen | Permission | Roles |
| --- | --- | --- |
| Home, Customers, customer detail | `admin.customers.read` | all |
| Verify / Reject / Reopen, New customer, Edit profile, Resend link, Mark email confirmed | `admin.customers.verify` | SUPER_ADMIN, OPS |
| Subscription add / renew / edit / cancel | `admin.subscriptions.write` | SUPER_ADMIN, OPS |
| Suspend / Reactivate | `admin.customers.suspend` | SUPER_ADMIN, OPS |
| Audit log | `admin.audit.read` | SUPER_ADMIN, OPS |
| Staff | `admin.staff.manage` | SUPER_ADMIN |
| Settings | `admin.settings.manage` | SUPER_ADMIN |

## Screens

| Path | What |
| --- | --- |
| `/login`, `/setup?token=…` | Sign in (password → TOTP), first-time setup from a one-time link (password → TOTP enrolment) |
| `/` | Home: counter tiles (each links to a pre-filtered Customers list) and the pending verification queue |
| `/customers` | Search, filters in the URL, sort, "Load more", **Export CSV**, **New customer** |
| `/customers/new` | Create a customer (organization, profile, owner, subscription) |
| `/customers/[id]?tab=` | Overview, Subscription, Usage, Workspace, Activity + the action bar (Verify, Reject, Reopen, Suspend, Reactivate, Edit profile, Resend link, Mark email confirmed) |
| `/staff` | Invite (shows a one-time setup link to copy; no email yet), edit, disable / enable, reset two-step, resend setup link |
| `/audit` | Every staff action; filters for staff, organization, action, date |
| `/settings` | Signup alert emails, default limits, grace days, pending seat cap, expiry notice days |

## Code layout

| Path | What |
| --- | --- |
| `lib/api.js` | Admin API client: `api(path)` relative to `/api/v1/admin`, credentials included, one refresh + retry on 401 via `/auth/refresh` (shared in-flight refresh), `ApiError { status, code, details, reason }`, human error copy; `staffAuth.*` for §12.1; `apiDownload()` for CSV |
| `lib/auth.js` | `AuthProvider` / `useAuth()`: `status`, `staff`, `role`, `permissions`, `can(perm)`, `login`, `setupAccount`, `completeTotp`, `logout`; restores the session from the refresh cookie on load; re-checks `/auth/me` on tab focus (at most once a minute) |
| `lib/nav.js` | Sidebar items and the permission each needs |
| `lib/customers.js`, `lib/customer-detail.js`, `lib/staff.js`, `lib/audit.js`, `lib/settings.js` | URL ↔ filter helpers and API wrappers per screen |
| `components/auth/totp-step.jsx` | TOTP enrol / verify step shared by `/login` and `/setup` |
| `components/shell/*` | App shell, admin badge, `PageHeader`, `RequirePermission` |
| `components/customers/*`, `components/subscriptions/*` | Status badge, usage meter, customer table, detail tabs, lifecycle dialogs, subscription form |
| `components/staff/setup-link-panel.jsx` | The only place that shows staff setup links (swap it when setup links are emailed) |
| `app/login`, `app/setup` | Public screens |
| `app/(app)/*` | Signed-in screens (redirect to `/login?next=…` without a session) |
| `scripts/dev-api.mjs` | Local only: runs the backend with the admin API on |
| `scripts/totp-code.mjs` | Local only: prints the current TOTP code for the local test account |

## Environment

`CRM-admin` (`.env.local` locally, optional `/var/www/dotcod-crm/.env.admin` on the server; see
`.env.example`):

| Var | Default | Notes |
| --- | --- | --- |
| `API_PROXY_TARGET` | `http://127.0.0.1:4100` | Nest API origin for the `/api/v1/admin/*` rewrite in `next.config.js`. Baked in at build time. On the server keep the default (API on the same host). |
| `NEXT_PUBLIC_API_ORIGIN` | unset | **Leave unset** everywhere. The browser must call same-origin `/api/v1/admin` so the `SameSite=Strict` refresh cookie is sent. `deploy.sh` warns if it is set. |
| `NEXT_DIST_DIR` | `.next` | Separate build folder while a dev server runs. |

Backend (`CRM-backend-server/.env`; on the server `/var/www/dotcod-crm/.env.backend`). The admin
API is **off** (every `/api/v1/admin/*` → 404) unless both `ADMIN_PORTAL_ORIGIN` and
`ADMIN_JWT_SECRET` are set.

| Var | Demo value | Notes |
| --- | --- | --- |
| `ADMIN_PORTAL_ORIGIN` | `https://admin-demo-crm.dotcod.in` | Exactly this app's origin (no trailing slash). Any other `Origin` → 403 `ORIGIN_NOT_ALLOWED`; a POST without `Origin` → 403 too. Base of staff setup links unless `ADMIN_PORTAL_URL` is set. |
| `ADMIN_PORTAL_URL` | unset | Optional base for setup links and the link in signup alert emails. |
| `ADMIN_JWT_SECRET` | secret | 32+ characters, different from every other secret. Changing it signs every staff member out. |
| `ADMIN_COOKIE_PATH` | default `/api/v1/admin/auth` | Path of the `dotcod_admin_rt` cookie as the browser sees it. The admin host has no `/rest` prefix, so keep the default. (The portal needed `AUTH_COOKIE_PATH=/rest/api/v1/auth/refresh` because it calls `/rest/...`.) |
| `CHANNEL_SECRET_KEYS`, `CHANNEL_SECRET_ACTIVE_KID` | secret | TOTP secrets are encrypted with this keyring. Without it TOTP enrolment fails. Rotating it away from a kid makes every staff TOTP unreadable. |
| `APP_URL` | `https://demo-crm.dotcod.in` | The **customer portal** URL: set-password and email-confirmation links point there. Must be public. |
| `TRUST_PROXY_CIDRS` | e.g. `127.0.0.1/32` | So rate limits (admin login 10 / 15 min per IP) see the real client IP behind nginx. |

The shared local backend `.env` has `ADMIN_PORTAL_ORIGIN` but no `ADMIN_JWT_SECRET` or keyring,
so use `npm run dev:api` locally (next section).

## Run locally

```bash
npm install
```

1. Start an admin-enabled API on `:4150`. The first run writes dev-only secrets to
   `.local/admin-api.env` (gitignored; keep it, local staff TOTP secrets are encrypted with it):

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

Local test data: `CRM-backend-server/scripts/seed-bo17-admin-customers.ts` (slug prefix
`bo17-seed-`, `--reset` / `--remove`).

## Build

```bash
npm run build
```

```bash
npm start
```

`output: 'standalone'`, like the portal. `next.config.js` sets `X-Frame-Options: DENY`,
`frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` and removes
`X-Powered-By`.

## Deploy (demo)

The demo server runs everything from `/var/www/dotcod-crm` with PM2 and nginx, deployed by
`hosting/deploy.sh` (in the CRM workspace root, copied to the server):

```bash
cd /var/www/dotcod-crm && ./deploy.sh admin
```

`deploy.sh admin` pulls `main` of `git@github.com:arunDotcod/CRM-admin.git` into
`/var/www/dotcod-crm/CRM-admin`, runs `npm ci` + `npm run build`, copies `static/` and `public/`
into the standalone bundle and (re)starts PM2 app **`dotcod-admin`** on `127.0.0.1:3300`.
Override the branch with `ADMIN_BRANCH=… ./deploy.sh admin`. Deploy the backend first
(`./deploy.sh backend`) when admin screens need new API routes; it also runs
`prisma migrate deploy`.

nginx for `admin-demo-crm.dotcod.in` (TLS by Let's Encrypt, HTTP → HTTPS redirect):

- `/` → `http://127.0.0.1:3300` (Next).
- `/api/v1/admin/` → `http://127.0.0.1:4100` (backend), or let Next's rewrite proxy it. Either
  way the browser path is `/api/v1/admin/...`, which matches the cookie path.
- Nothing else of the backend is exposed on this host (customer `/api/v1/*` and `/rest/*` → the
  Next 404 page).

Checks after a deploy (from anywhere):

```bash
curl -sI https://admin-demo-crm.dotcod.in/login | head -1                                      # 200
curl -s -H "Origin: https://admin-demo-crm.dotcod.in" https://admin-demo-crm.dotcod.in/api/v1/admin/settings   # 401 JSON
curl -s -H "Origin: https://evil.example" https://admin-demo-crm.dotcod.in/api/v1/admin/auth/me            # 403 ORIGIN_NOT_ALLOWED
```

The full BO21 verification and the open server items are in `tasks/bo21-server-checklist.md`
(CRM workspace root).

## Auth flow (api-contracts §12.1)

1. `POST /auth/login {email, password}` → `{ stage, challengeToken, expiresIn: 300 }`.
2. `stage = totp_enrol`: `POST /auth/totp/enrol` (Bearer challenge) → `{ otpauthUrl, secret, qrSvg }`.
3. `POST /auth/totp/verify {code}` (Bearer challenge) → `{ accessToken (15 min), session, staff }` and
   the `dotcod_admin_rt` cookie (`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/admin/auth`).
4. On load and on any 401, `POST /auth/refresh` rotates the cookie (12-hour absolute session).
5. `POST /auth/logout` revokes the session and clears the cookie.

The access token is kept in memory only. 5 wrong codes burn a challenge; 5 failed sign-ins lock
the account for 15 minutes.
