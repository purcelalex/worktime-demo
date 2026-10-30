# Specification: Phase 1

Status: DRAFT for the author's approval, 2026-10-29. Scope: the job assignment core, the demo module, 20 demo accounts, deployment. Requirements come from the private base prompt; structure from `docs/ARCHITECTURE.md`. Where this file adds detail, it is the reference for implementation and tests.

## 1. Scope

**In:** login (demo accounts), employees, timers with task descriptions, per-employee records and totals for a period, persistence, landing page with "Explore the demo", PWA shell, 20 seeded demo organizations, deployment at `worktime.purcelalex.com`, tests, documentation.

**Out (later phases):** Super Admin, real accounts (magic link, passkeys, sign-up, invitations), roles beyond the demo `admin`, per-organization time zones, export, audit log, dark theme, editing or deleting time entries, deleting employees, public repository export (done after Phase 1 is verified).

## 2. Users and roles

- One role is exercised in Phase 1: the demo account has role `admin` inside its own demo organization.
- A user can do everything inside their own organization and nothing outside it.
- "Employee" is a tracked person without a login.

## 3. Screens

### 3.1 Landing `/`
- Product name, one sentence ("Track your team's working time. Start a timer, see the totals."), a note "Demo with fictional data".
- One large primary button **Explore the demo** (full width on phone, at least 56 px high) leading to `/login`.
- States: if a valid session exists, the button reads **Open the app** and leads to `/app/timer`.

### 3.2 Login `/login`
- Banner: **Test mode. Use the demo account details you were given.**
- Fields: **Account** (text, no autocapitalize, no spellcheck) and **Password** (with show/hide control). Button **Sign in**.
- Errors: wrong details give "Invalid account or password" (identical for unknown account and wrong password); rate limit gives "Too many attempts. Try again in a few minutes."; network failure gives "Cannot reach the server. Check your connection and try again."
- On success: go to `/app/timer`. A signed-in visitor opening `/login` is redirected to `/app/timer`.

### 3.3 App shell `/app/*`
- Not signed in: redirect to `/login`.
- Header: app name, a **Demo** badge with the account name, **Log out**.
- Navigation: three destinations, **Timer**, **Employees**, **Reports**. Bottom tab bar below 1024 px, left sidebar from 1024 px.

### 3.4 Timer `/app/timer`
- One card per active employee, sorted: running first (longest running first), then idle by name.
- **Idle card:** name, position, a green **Start** button. Start opens a sheet (phone) or dialog (desktop) with a **Task description** field (required, counter "0/200"), **Start timer** and **Cancel**.
- **Running card:** name, task description, a large live clock `HH:MM:SS`, started-at time, and a **Stop** button. The clock is computed from `startedAt` and `serverNow` (offset taken from the last response), updated every second, announced to assistive tech only on start and stop (not every second).
- Empty states: no employees gives "No employees yet" with a button **Add an employee** (goes to Employees).
- Behavior: Start and Stop update the card immediately (optimistic) and roll back with a toast if the server rejects. A conflict (409) refreshes the list and shows the message from the server.

### 3.5 Employees `/app/employees`
- Search box filtering by name (client-side), list of employees with name, position and "Added <date>".
- **Add employee** button opens a sheet or dialog: **Full name** (required), **Position** (optional). Inline validation messages. Success closes the sheet, shows a toast "Employee added", and the list updates.

### 3.6 Reports `/app/reports`
- Period chips: **Today**, **Last 7 days**, **Last 30 days**, **Custom** (two date inputs, from and to, inclusive). Default: Last 7 days.
- Dates are the browser's local calendar days; `from` is the local start of the first day, `to` is the local end of the last day, both sent as UTC instants.
- Content, in order: a summary line (total time for all employees and number of records), a bar chart of hours per employee (lazy-loaded), and a table with one row per employee: name, number of records, total time. A row expands to the records: task, start, stop (or "Running"), duration.
- On phones the table is shown as stacked cards.
- **Empty state** when the period has no records at all: the message "No records for this period" with a hint "Try a longer period", shown instead of the chart and table. Employees with zero records in a period that has other records still appear with `0h 00m`.
- Loading: skeleton placeholders. Error: a retry button.

### 3.7 Other
- Unknown URL: a friendly 404 page with a link home.
- A top-level error boundary shows "Something went wrong" with a reload button.
- Offline: the shell loads from the service worker and shows "You are offline. Reconnect to continue." where data is needed.

### 3.8 Formats
- Durations: `Hh MMm` in lists (for example `2h 05m`), `HH:MM:SS` for the live clock. Under one minute lists show `<1m`.
- Dates and times use the browser's locale and time zone.
- All UI strings come from `src/web/strings.ts` and are in English.

## 4. API

Base path `/api`. JSON only. Success: `200` (or `201` on creation) with the body below. Errors use one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Full name is required", "fields": { "fullName": "Full name is required" } } }
```

Codes: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `INTERNAL` 500. Messages never expose internals.

All endpoints except `POST /api/auth/login` require a session. All state-changing requests require `Content-Type: application/json` and a same-origin `Origin` header.

| Endpoint | Request | Success response |
|---|---|---|
| `POST /api/auth/login` | `{ username, password }` | `{ user: { id, username, role }, organization: { id, name, kind }, serverNow }` and the session cookie |
| `POST /api/auth/logout` | none | `{ ok: true }`, cookie cleared |
| `GET /api/auth/me` | none | same shape as login |
| `GET /api/employees` | none | `{ employees: [{ id, fullName, position, createdAt }] }` ordered by name |
| `POST /api/employees` | `{ fullName, position? }` | `201 { employee }` |
| `GET /api/timers` | none | `{ serverNow, timers: [{ id, employeeId, description, startedAt }] }` |
| `POST /api/employees/:id/timer/start` | `{ description }` | `201 { serverNow, timer }` |
| `POST /api/employees/:id/timer/stop` | none | `{ serverNow, entry: { id, employeeId, description, startedAt, stoppedAt, durationMs } }` |
| `GET /api/reports/summary?from=<ms>&to=<ms>` | query in UTC epoch ms | see 4.1 |

### 4.1 Report response

```json
{
  "serverNow": 1760000000000,
  "from": 1759500000000, "to": 1760000000000,
  "totalMs": 0, "entryCount": 0,
  "employees": [
    { "id": "...", "fullName": "...", "position": null, "totalMs": 0, "entryCount": 0,
      "entries": [ { "id": "...", "description": "...", "startedAt": 0, "stoppedAt": null, "durationMs": 0, "running": false } ] }
  ]
}
```

Every active employee appears, in name order, even with zero entries. `entries` are ordered by `startedAt` descending. `durationMs` is the duration inside the period (see 5.4).

## 5. Rules

### 5.1 Validation
- `fullName`: trimmed, 1 to 100 characters, no control characters. Duplicate within the organization (case-insensitive after trimming) gives 409 `CONFLICT` "An employee with this name already exists".
- `position`: optional, trimmed, up to 100 characters; empty becomes null.
- `description`: trimmed, 1 to 200 characters, no control characters.
- `from`, `to`: integers, `from <= to`, `to - from` at most 366 days, both within a sane range (year 2000 to 2100).
- Maximum 50 employees per demo organization (409 `CONFLICT` "Employee limit reached for this demo").
- Unknown fields in bodies are rejected (strict schemas).

### 5.2 Timer rules
- Start: employee must exist in the caller's organization (else 404) and be active; no running entry may exist (else 409 "This employee already has a running timer"). The server sets `startedAt = now`.
- Stop: a running entry must exist (else 409 "No running timer for this employee"). The server sets `stoppedAt = max(now, startedAt)`.
- **Restart** is stop followed by start: it creates a new independent entry. Entries are never merged or reopened.
- The partial unique index guarantees one running entry per employee even under concurrent requests; a concurrent second start returns 409.

### 5.3 Isolation
- Every repository function takes `orgId` from the session, never from the request. An id from another organization behaves exactly like a non-existent id (404).

### 5.4 Report calculation
- An entry belongs to the period if `startedAt < to` and (`stoppedAt` is null or `stoppedAt > from`).
- Its duration in the report is `min(stoppedAt ?? serverNow, to) - max(startedAt, from)`, never negative.
- `totalMs` per employee is the sum of those durations; the grand total is the sum over employees.
- `entryCount` counts entries that belong to the period.
- Inactive employees are not listed (Phase 1 has no way to deactivate, so this is future-proofing).

### 5.5 Authentication and sessions
- Session token: 32 random bytes, base64url; stored as SHA-256 hash with `expires_at` (7 days); cookie `__Host-session; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
- Login rate limit: 5 failed attempts per 15 minutes per username and 20 per IP; then 429 until the window ends. A successful login clears the username counter.
- Password check: PBKDF2-SHA256, per-user salt, 100,000 iterations; a dummy hash is computed for unknown usernames; comparison in constant time.
- Expired sessions are rejected and deleted lazily.

### 5.6 Headers and caching
- Security headers as in the private base prompt section 6 on every response.
- API responses: `Cache-Control: no-store`. Static hashed assets: long-lived immutable caching. `index.html`: no-cache.
- The service worker precaches the app shell only and never handles `/api/*`.

## 6. Demo data

- 20 organizations "Demo Company 1" to "Demo Company 20", `kind = 'demo'`; user `test-account_1` to `test-account_20`, role `admin`.
- Each organization has 7 fictional employees. Names are drawn from a fixed list of invented names (for example "Alex Morgan", "Sam Rivera"), each with a position (Developer, Designer, Support, Analyst, Manager, QA, Operations). The names are the same across organizations only where the seed picks the same fixed list; no real person is referenced.
- History: the previous 14 days, weekdays only, 1 to 4 entries per employee per day, within 08:00 to 18:00 UTC, task texts from a fixed list of generic tasks ("Code review", "Client call", "Writing documentation", "Bug triage", ...), durations 15 minutes to 3 hours, no overlaps per employee, none running. A small random share of employees has no entry on a given day. Seed is deterministic per organization number so results are reproducible.
- `scripts/seed-demo.ts`: `--local` or `--remote`; idempotent; `--reset <n>` restores workspace n; `--rotate <n>` issues a new password; outputs hashes into generated SQL and plain passwords only into `secrets/demo-credentials.md` (both git-ignored). Password format: two words from a curated list, two digits and one symbol (at least 12 characters), for example `word-word-NN!` (two words, two digits, one symbol).

## 7. Non-functional requirements

- **Performance:** API responses under 300 ms at the edge for typical data; initial JavaScript for the landing page under 100 KB gzip (the signed-in app and the chart are split into chunks; measured 98.5 KB gzip); Lighthouse mobile at 90 or higher in all four categories on `/`, `/login`, `/app/timer`.
- **Accessibility:** WCAG 2.2 AA; axe reports zero serious or critical issues on every screen; full keyboard operation; focus returns to the trigger when sheets close.
- **Browsers:** current Chrome, Safari (iOS and macOS), Firefox and Edge.
- **Security:** everything in the private base prompt section 6 and `docs/ARCHITECTURE.md` section 6; zero CSP violations in the console on every screen.
- **Privacy:** only the data listed in section 5.1 is stored; logs hold ids and event types only.

## 8. Test cases (IDs used in `TEST_SCENARIOS.md` and `TEST_LOG.md`)

**Employees:** TC-EMP-01 add valid; 02 reject empty; 03 reject over 100 characters; 04 reject duplicate (case-insensitive); 05 position optional and trimmed; 06 limit of 50 per demo organization; 07 list ordered by name.

**Timer:** TC-TMR-01 start then stop gives the correct duration; 02 description required, whitespace-only rejected; 03 start while running gives 409; 04 stop while idle gives 409; **05 restart: stop then start creates a second entry**; 06 two employees run timers at once; 07 concurrent starts for one employee leave exactly one running entry; 08 unknown employee gives 404.

**Reports:** TC-REP-01 totals equal the sum of entries; **02 empty report: employees without entries show zero**; 03 organization without employees returns an empty list; 04 period with no overlapping entries returns zeros and the UI shows the empty state; 05 an entry crossing the period start is clipped; 06 an entry crossing the period end is clipped; 07 a running entry counts up to now; 08 `from > to` rejected; 09 range over 366 days rejected; 10 entries of other organizations never appear.

**Persistence:** TC-PER-01 data written by one app instance is read by a fresh instance on the same database; 02 a running timer survives a restart and its elapsed time continues; 03 the local dev database survives restarting `npm run dev`.

**Authentication:** TC-AUT-01 valid login sets the cookie; 02 wrong password and unknown user give the same response; 03 rate limit after 5 failures; 04 protected endpoints return 401 without a session; 05 logout invalidates the session; 06 expired session rejected; 07 cookie flags are correct; 08 demo accounts cannot see each other's data (TC-ISO below).

**Isolation:** TC-ISO-01 organization A cannot read, start, stop or report on B's employees (404); 02 session org always overrides any org value in the request.

**Security:** TC-SEC-01 security headers on a page and on an API response; 02 CSP has no `unsafe-inline` or `unsafe-eval`; 03 state-changing request without JSON content type or with a foreign `Origin` is rejected; 04 static probing returns no real file for `/.git/HEAD`, `/.git/config`, `/.env`, `/.env.local`, `/package.json`, `/src/*`, `/wrangler.jsonc`, `/node_modules/*`, `/migrations/*`; 05 no source maps in production; 06 no secrets in the bundle (scan); 07 `npm audit` at 0; 08 secret scan of the git history is clean; 09 no credential or hash exists in the repository; 10 cookies are host-only.

**UI (Playwright, phone 390×844 and desktop 1280×800, axe):** TC-UI-01 landing button leads to login; 02 login errors; 03 full flow: login, add employee, start, stop, restart, view report; 04 empty report state; 05 bottom tab bar on phone and sidebar on desktop; 06 no horizontal scroll at 360 px; 07 keyboard-only flow; 08 zero axe serious or critical issues; 09 zero CSP violations; 10 offline shell message.

**Deployment (live):** TC-DEP-01 `https://worktime.purcelalex.com` serves over HTTPS with HSTS; 02 the `*.workers.dev` address behaves the same or is disabled; 03 two different demo accounts are isolated on the live site; 04 PBKDF2 login works within the Workers CPU limit of the chosen plan (record the plan and measured time).

## 9. Acceptance

Phase 1 is accepted when all test cases above pass and are logged in `docs/TEST_LOG.md`, the Definition of Done in the private base prompt section 13 is met, and the author has reviewed the live site on a phone and on a desktop.

## 10. Decisions made in this specification

1. Duplicate employee names are rejected (simple and testable); revisit in Phase 3.
2. Report periods use the browser's local days; per-organization time zones arrive in Phase 3.
3. Employees cannot be edited or deleted in Phase 1, and time entries cannot be edited or deleted; this keeps the audit story simple until Phase 3 adds the audit log.
4. The live clock is not announced every second to screen readers, only on start and stop.
5. The default report period is the last 7 days, which matches the seeded history.
6. Login rate limits are 5 failures per username and 20 per IP in a 15-minute window (the first draft said 5 per IP, which would lock out a whole company sharing one address; see AI_LOG entry 2).
7. Sheets and dialogs use the native HTML dialog element; the report chart is hand-built HTML. No UI or chart library is used.
8. TC-UI-10 means: the app shell loads offline from the service worker, and screens that need data show the network error with a retry button ("Cannot reach the server...").
9. End-to-end tests use a local-only account (`e2e-user`) created by `npm run e2e:setup`; it never exists in migrations, the demo seed or production.
10. GDPR: a public `/privacy` page, a "fictional data only" notice in demo workspaces, and a daily retention job (expired sessions; login-throttling rows older than 24 hours). Demo and real data live in physically separate environments (see `docs/PRIVACY_GDPR.md`).

## 11. Pause, resume and delete employee (added 2026-10-30)

### 11.1 Pause and resume
- **Segments.** A work period is a segment (one `time_entries` row). Pausing closes the running segment and marks it `paused`; resuming starts a new segment of the same task that carries the time already worked (`carried_ms`), so the clock continues instead of restarting. Time spent paused is never counted. Migration: `0002_pause_resume.sql` (`end_reason`, `carried_ms`, one paused timer per employee enforced by a partial unique index).
- **Timer card.** Idle: **Start**. Running: **Pause** and **Stop**. Paused: **Resume** and **Stop**, an amber "Paused" state with the clock frozen at the time worked so far. Order on the screen: running, paused, idle.
- **API.** `POST /api/employees/:id/timer/pause` and `.../resume` (same guards as start and stop). `GET /api/timers` now returns running and paused timers, each with `state`, `pausedAt` and `carriedMs`. Time worked: running `carriedMs + (now - startedAt)`, paused `carriedMs + (pausedAt - startedAt)`. Stop returns `durationMs` (last segment) and `totalMs` (whole task).
- **Rules.** Pause needs a running timer (else 409). Resume needs a paused timer (else 409). Start while paused returns 409 ("Resume or stop it first"). **Stop while paused** ends the task and adds no time. Two simultaneous resumes create exactly one running segment.
- **Reports.** A paused task appears as separate work records, one per segment; the pause itself is not a record and adds no time. "2 records" can therefore mean one task that was paused once.

### 11.2 Delete employee
- **UI.** A **Delete employee** button next to **Add employee**. Step 1: choose the employee. Step 2: the question "Are you sure you want to delete <name> from the list of employees?" with **No, keep** (focused by default) and **Yes, delete**.
- **Soft delete.** The employee leaves the employees list and the Timer screen but is not erased: `is_active = 0` and `deleted_at` are set (migration `0003_employee_soft_delete.sql`). Their time records stay in the history: reports include a deleted employee, with a "Deleted" badge, whenever they have records in the chosen period; with no records in the period they are not listed.
- **Rules.** `DELETE /api/employees/:id`. Refused with 409 while the employee has a running or paused timer ("Stop this employee's timer before deleting them"). Unknown, already deleted or other-organization ids return 404. The name can be reused after deletion (uniqueness now applies to active employees only).
- **GDPR note.** Soft delete hides an employee; it is not the right to erasure. A real erasure or anonymization feature belongs to Phase 3 (see `docs/PRIVACY_GDPR.md` section 5).

### 11.3 Test cases
TC-TMR-09 to TC-TMR-17 (pause and resume, API), TC-UI-13 (pause and resume in the browser), TC-EMP-08 to TC-EMP-14 and TC-ISO-03, TC-ISO-04 (delete and isolation, API), TC-UI-14 (delete with confirmation, browser). See `docs/TEST_SCENARIOS.md`.
