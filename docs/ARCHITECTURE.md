# Architecture

Status: DRAFT for the author's approval. Covers Phase 1 in detail and shows where Phases 2 to 4 attach. The authoritative requirements are in the private base prompt.

## 1. Goals

1. Satisfy the job assignment completely (add employees, timer with task, per-employee totals for a period, persistence, tests, README) and look and feel like a finished product.
2. Be a **mobile-first** application that is equally good on a phone and on a desktop.
3. Be **secure by design**: collect as little data as possible, isolate every organization, protect every entry point.
4. Stay reusable: a portfolio project today, a sellable multi-tenant product tomorrow.
5. Reuse what the author already knows from Expenses Manager (React, Vite, Tailwind, the same green and white identity), so the code is familiar and the explanation to an employer is easy.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Hosting | Cloudflare Workers with static assets | One deployable unit, global edge, no server to patch |
| API | Hono (TypeScript) | Small, fast, typed end to end through its RPC client |
| Database | Cloudflare D1 (SQLite) with Drizzle ORM | Relational data and reports fit SQL; Drizzle gives typed queries and migrations |
| Validation | zod, shared by client and server | One schema defines the rule on both sides |
| Frontend | React 19, Vite, TypeScript (strict), React Router | Same tools as Expenses Manager |
| Styling | Tailwind CSS 4 with design tokens in CSS | Same approach as Expenses Manager |
| Server state | TanStack Query | Caching, retries, optimistic updates for the timer |
| Accessible primitives | Native HTML `<dialog>` for sheets and dialogs | Focus trap, Escape, inert background and focus return come from the browser; no library needed |
| Charts | A small hand-built HTML bar chart, lazy-loaded on the Report screen | Lighter and sharper than a library, no extra inline-style concerns under the CSP |
| Font | Onest Variable, self-hosted (`@fontsource-variable/onest`) | Same as Expenses Manager; no external font requests, so the CSP stays strict |
| Mobile delivery | Installable PWA (manifest, icons, offline app shell) | A phone app feel without app stores |
| Tests | Vitest 4 (unit and API integration with `@cloudflare/vitest-plugin` on a real local D1), Playwright (end to end at phone and desktop sizes) with axe accessibility checks | Covers logic, API, and the real UI |
| Tooling | npm, Wrangler, `@cloudflare/vite-plugin`, oxlint | Local dev runs the same runtime as production |

Trade-off, stated honestly: this is more modern and consistent with the author's other work, but it has more dependencies than a plain HTML approach. The mitigations are a lockfile, `npm ci`, `npm audit` at 0, Dependabot, and a short written reason for every runtime dependency in this file's appendix.

## 3. System Overview

```
 Phone / Desktop browser (installable PWA)
        |  HTTPS only
        v
 Cloudflare edge: WAF + rate limiting (+ Turnstile on public login)
        |
        v
 Worker (one deployment)
   ├─ static assets: built React app (SPA fallback), security headers
   └─ /api/*  Hono app
        ├─ middleware: security headers, origin check, session, org context, rate limit
        ├─ routes: auth, employees, timers, reports  (+ module routes)
        └─ data-access layer (Drizzle): every query takes orgId
        |
        v
 D1 database (SQLite, point-in-time restore)
```

The frontend and the API share TypeScript types and zod schemas from `src/shared/`. The browser talks to the API with the typed Hono client, so a change in an endpoint breaks the build instead of breaking at runtime.

## 4. Repository Layout

```
src/
  shared/              zod schemas, types, constants (used by both sides)
  worker/
    index.ts           Hono app, module registry
    routes/            auth.ts employees.ts timers.ts reports.ts
    middleware/        security-headers.ts origin-check.ts session.ts rate-limit.ts
    db/                schema.ts (Drizzle), tenant-scoped repositories
    lib/               password.ts session.ts time.ts
    modules/
      demo/            demo-only code        (excluded from the Clean edition)
      superadmin/      Phase 2 only          (excluded from the Clean edition)
  web/
    main.tsx  app.tsx  routes/
    components/        ui primitives, TimerCard, EmployeeList, ReportTable ...
    features/          timer/ employees/ reports/ auth/
    modules/demo/      landing "Explore the demo" button, test-mode login banner
    styles/            tokens.css (design tokens), base.css
    strings.ts         every UI string in one place
migrations/            Drizzle SQL migrations
scripts/               seed-demo.ts
tests/                 unit/ api/ e2e/
public/                manifest.webmanifest, icons, _headers
docs/
```

Rules: `web/` never imports from `worker/` (only from `shared/`). Core code never imports from `modules/`. Modules are registered in one file each side, so a build flag can leave them out (Clean edition, Phase 4).

## 5. Data Model

As in the private base prompt section 4: `organizations`, `users`, `sessions`, `login_attempts`, `employees`, `time_entries`. Additions and clarifications:

- **Data minimization (a hard rule).** The application stores only what time tracking needs: an employee's name, an optional position, and the task text. It must never ask for or store national identity numbers (such as IDNP), addresses, phone numbers, birth dates or documents. If a future feature seems to need such data, the author decides explicitly and the data is encrypted and documented.
- Timestamps are UTC epoch milliseconds. The server clock is the only clock.
- One running timer per employee is enforced by a partial unique index, not only by code.
- Tenant isolation: the repositories require `orgId`; a test suite attempts every endpoint with another organization's ids.
- Phase 3 adds `audit_log` (append-only) for every change to a time entry or user.

## 6. Security Architecture

The threat model assumes automated attacks (credential stuffing, bots, scanning), targeted attempts to reach another organization's data, supply-chain attacks through dependencies, and leaked credentials. The recent large data theft from state systems in Moldova is a reminder of how costly weak access control and over-collection are. We do not rely on any specific report; the lessons below are general and standard.

### 6.1 Principles

1. **Collect less.** Data that is not stored cannot be stolen (section 5).
2. **Isolate tenants** in the data layer and prove it with tests.
3. **Defense in depth.** Edge protection, application checks, database constraints.
4. **Least privilege** for every person, token and service.
5. **No secrets in code.** Secrets live in Cloudflare secrets and local `.dev.vars`.
6. **Detect and recover.** Logs without personal data, alerts, and restorable backups.

### 6.2 Authentication

| Account type | Method |
|---|---|
| Demo (20 accounts) | Username and random 12+ character password; rate limited; Turnstile challenge after repeated failures |
| Real users (Phase 3) | **Magic link and passkeys (WebAuthn). No passwords stored at all**, so there is nothing to crack or leak |
| Super Admin (Phase 2) | Passkey required, behind **Cloudflare Access** so attackers cannot even reach the login form; no hardcoded credentials, created by a one-time bootstrap secret |

- Sessions: 256-bit random token, only its SHA-256 hash is stored; cookie `__Host-session`, `HttpOnly; Secure; SameSite=Lax`; 7-day expiry for demo, shorter and re-authenticated for admin actions; logout and "sign out everywhere" delete rows.
- Demo password hashing: PBKDF2-SHA256 with the highest iteration count Workers allow (100,000), per-user salt. This is below the current recommendation for human-chosen passwords, which is acceptable here because demo passwords are long random strings and real accounts have no passwords. The Workers CPU limit for this operation must be verified on the target plan in Phase 1 and recorded in `TEST_LOG.md`.
- Constant-time comparison, a dummy hash for unknown users, and generic error messages.

### 6.3 Network and Browser Protection

- Cloudflare WAF and rate-limiting rules in front of `/api/auth/*`; Turnstile on the public login (optional and owner-configurable in the Clean edition).
- Headers on every response: strict CSP (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`, `font-src 'self'`, `connect-src 'self'`, `img-src 'self' data:`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`) plus `require-trusted-types-for 'script'`; HSTS with preload-ready settings; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP and CORP.
- No inline scripts or styles, no `dangerouslySetInnerHTML`, `eval` or `document.write`. React escapes output; user text is only ever rendered as text.
- CSRF: `SameSite` cookies, a required JSON content type, and an `Origin` check on every state-changing request.
- The service worker caches the static app shell only. It never caches API responses, so no personal data lands in a browser cache.

### 6.4 Application and Data Protection

- Every input is validated with zod on the server; every response is shaped explicitly (no raw database rows); errors are generic and never include stack traces.
- Parameterized queries only (Drizzle).
- D1 point-in-time recovery (Time Travel) is the backup; the restore procedure is documented and rehearsed once.
- Logs contain ids and event types, never names or task text.
- Real organizations get data export and deletion on request (Phase 3).

### 6.5 Supply Chain and Repository

- Lockfile committed, `npm ci` in CI, `npm audit` at 0 vulnerabilities, Dependabot alerts and security updates enabled, a minimal dependency list with a written reason for each.
- GitHub Actions (if used) pin third-party actions to commit SHAs and use the minimum token permissions.
- The development repository is private; the public repository is a generated export of the Demo edition with a fresh history. `.gitignore` covers `.dev.vars*`, `.env*`, `secrets/`, generated seed files; the private history and every export are scanned for secrets before each release.
- Manual steps for the author, as in the global security strategy: 2FA on email, Cloudflare and GitHub accounts with offline recovery codes; Cloudflare API tokens scoped to this project only; a GitHub ruleset blocking force-push and deletion of the default branch.

### 6.6 Environment separation and privacy

- **Demo and real environments are physically separate**: different Worker, different D1 database, different domain, different secrets and tokens. The demo Worker has no binding to, and no credentials for, any real database, so a demo user (or a leaked demo password) can never reach real data. Logical tenant isolation remains as a second layer, not the only one.
- The demo holds fictional data only, and says so on the login page, in the app and in the privacy notice.
- Retention is automated: a daily scheduled job deletes expired sessions and old login-throttling rows.
- GDPR roles, data inventory, retention, data subject rights, breach procedure and the pre-launch checklist are in `docs/PRIVACY_GDPR.md`.

## 7. User Interface Architecture

### 7.1 Visual identity (same as Expenses Manager: green and white)

Design tokens live in `src/web/styles/tokens.css` (Tailwind 4 `@theme`):

| Token | Value | Use |
|---|---|---|
| `--color-brand` | `#7bb661` | Fills, bars, icons, the running-timer accent (not text) |
| `--color-brand-ink` | `#3d7f2e` | Green text and primary buttons with white text (contrast 4.9:1) |
| `--color-brand-strong` | `#2f6a24` | Pressed and hover state |
| `--color-ink` | `#1f2a24` | Main text |
| `--color-neutral` | `#5f6b64` | Secondary text |
| `--color-surface` | `#f3f5f1` | Cards and panels |
| page background | `#ffffff`, outer field `#eef1ec` | Page |
| `--color-warn` / `--color-warn-ink` | `#d98a00` / `#8f5200` | A very long running timer |
| `--color-danger` | `#c0392b` | Errors only |

Typography: Onest Variable with tabular numerals, so durations line up and do not jump. Phase 1 ships a light theme only; a dark theme is a later enhancement built on the same tokens.

### 7.2 Layout and navigation

- **Mobile first** (design at 360 px width, then scale up).
  - Phone: a fixed **bottom tab bar** with three tabs, **Timer**, **Employees**, **Reports**; thumb-reachable actions; touch targets of at least 44 px; safe-area insets; `100dvh` (not `100vh`); form fields at 16 px so iOS does not zoom.
  - Desktop (1024 px and up): a left sidebar with the same three destinations, wider tables, and a two-column Timer screen.
- **Timer screen (the hero).** A card per employee with their state: idle (a green **Start** button) or running (a large live clock in brand green and a **Stop** button). Starting opens a bottom sheet (phone) or dialog (desktop) asking for the task description. Optimistic updates with rollback on error; the clock derives from the server's `serverNow` and `startedAt`.
- **Employees screen.** Searchable list, an add form in a sheet or dialog, inline validation, an empty state with a clear call to action.
- **Reports screen.** Period chips (Today, 7 days, 30 days, Custom), a summary bar chart of hours per employee, a table of totals that expands to the individual records. On phones the table becomes stacked cards. A friendly empty state when the period has no records.
- **Landing page** (`modules/demo`): a calm, modern presentation in the Expenses Manager style (soft green gradients, real HTML and SVG product pictures, no stock images), with one large **"Explore the demo"** button. **Login page**: a clear "Test mode" banner and two fields; nothing else.
- Skeleton loaders, toast confirmations, error boundaries, and a friendly offline message.

### 7.3 Quality bars

- WCAG 2.2 AA: contrast, visible focus, full keyboard operation, labels, live regions for timer changes, `prefers-reduced-motion` respected.
- Lighthouse targets on mobile: Performance, Accessibility, Best Practices and SEO all at 90 or higher; the initial JavaScript stays small (charts and the Report screen are code-split).
- All UI strings live in `strings.ts` (English only for now), which keeps a later translation possible without reworking components.

## 8. Build, Deploy and Environments

- `npm run dev`: Vite plus the Workers runtime locally (`@cloudflare/vite-plugin`), with a local D1 persisted under `.wrangler/state`.
- `npm run build`: type-check, build the SPA into `dist/client`, build the Worker.
- `wrangler.jsonc`: assets directory, SPA fallback, `run_worker_first: ["/api/*"]`, the D1 binding, and the custom domain `worktime.purcelalex.com`.
- Environments: local, and production. A separate preview environment can be added when a second person works on the project.
- Edition flag (`EDITION=full|clean`) is introduced in Phase 4; the module layout above already makes it possible.

## 9. Testing Architecture

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | Duration, clipping to a period, validation schemas |
| API integration | Vitest with the Workers pool and real local D1 | All endpoints, tenant isolation, persistence across app instances, empty report, timer restart, rate limiting, headers |
| End to end | Playwright | Login, add employee, start and stop, report; at phone and desktop sizes; axe accessibility checks; zero CSP violations in the console |
| Live checks | Manual and scripted | Static probing list, headers on production, two demo accounts isolated |

Every run that matters is recorded in `docs/TEST_LOG.md`; cases are listed in `docs/TEST_SCENARIOS.md`.

## 10. Phases and Where They Attach

- **Phase 1:** everything in sections 3 to 9 except `modules/superadmin`, magic link, passkeys and audit log.
- **Phase 2:** `modules/superadmin` (aggregates and metadata only), Cloudflare Access, passkeys for the Super Admin.
- **Phase 3:** real organizations, magic link and passkeys, roles and invitations, time zones, export, audit log.
- **Phase 4:** `EDITION=clean` build, verification package, first-run setup.

## Appendix: Runtime Dependencies and Reasons


| Package | Why it is needed |
|---|---|
| `hono` | Small, fast API framework for Workers (routing, cookies, middleware) |
| `drizzle-orm` | Typed query builder for D1; migrations are hand-written SQL in `migrations/` |
| `zod` | Strict request validation on the server (kept out of the browser bundle) |
| `react`, `react-dom` | UI library, same as Expenses Manager |
| `react-router-dom` | Client-side routing |
| `@tanstack/react-query` | Server-state caching, retries and optimistic updates for the timer |
| `@fontsource-variable/onest` | Self-hosted Onest font (no external font requests) |

Development only: `vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `wrangler`, `vitest`, `@cloudflare/vitest-plugin`, `@playwright/test`, `@axe-core/playwright`, `tsx`, `oxlint`, and the type packages.

Deliberately not used: a UI component library (native `<dialog>` instead), a chart library (a small HTML bar chart instead), the Hono RPC client (a plain `fetch` wrapper with shared types instead), and `drizzle-kit` (removed: unused and it carried vulnerable transitive dependencies).
