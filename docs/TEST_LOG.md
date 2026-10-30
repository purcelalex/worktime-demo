# Test Log (monitoring)

Append-only record of test runs. Failures are logged as they happened. Times are from the author's machine; all runs are local unless stated.

## 2026-10-29

### Environment
Windows 11, Node 24.21, npm 11.19, Vitest 4.1.12 with `@cloudflare/vitest-plugin` 1.4.11 (local Miniflare D1), Playwright 1.64 with the installed Chrome, Vite 8.3.5, Wrangler 4.156.

### Run 1: API tests (first run)
- Command: `npx vitest run`. Result: **26 passed** (employees, timers, reports). Authentication, isolation, security and persistence tests did not exist yet.

### Run 2: API tests with authentication added
- Result: **8 failed, 48 passed** of 56. Cause: every test shared one client IP, the IP rate limit reached its maximum, and later logins returned 429.
- Action: found a real design problem (see `AI_LOG.md` entry 2). Changed the IP limit to 20, gave each test its own IP, added a test for the IP limit.

### Run 3: API tests
- Result: **57 passed** (8 files). Covers TC-EMP-01..07, TC-TMR-01..08, TC-REP-01..10, TC-PER-01..02, TC-AUT-01..07 (plus extras), TC-ISO-01..02, TC-SEC-01..03, and unit tests for report clipping and password hashing.

### Seed script (local database)
- `npm run db:migrate:local` applied `0001_init.sql`. `npm run seed:demo` created 20 organizations, 20 users, 140 employees, 3,019 time entries, 0 running. `--reset 3` re-seeded workspace 3 (entry count unchanged at 3,019).
- Passwords were written only to the git-ignored `secrets/` folder and were not read or displayed.

### Run 4: End-to-end, desktop (first run)
- Failed at TC-UI-01 (CSP check): `require-trusted-types-for trusted-types-sink` caused by zod's `new Function("")` in the client bundle. Remaining tests did not run (serial mode). See `AI_LOG.md` entry 3.
- Fix: removed zod from the browser bundle. Added route-level code splitting. First-load JavaScript: 126.6 KB then 98.5 KB gzip.

### Run 5: End-to-end, desktop and phone
- Desktop: after the fix **9 passed, 1 failed** (TC-UI-07: focus did not move into the dialog), 3 not run. Fixed (`AI_LOG.md` entry 4).
- Full run: desktop **13 passed**; phone **1 failed** (TC-UI-03, a test selector picked a hidden element; test bug), 9 not run.
- Phone re-run after fixing the test: **13 passed**.

### Run 6: Final run of the day
- `npx vitest run`: **57 passed**. `npx playwright test`: **26 passed** (13 desktop at 1280×800, 13 phone at 390×844). `npm audit`: **0 vulnerabilities** (after removing the unused `drizzle-kit`). `npx oxlint`: no warnings. `npx tsc -b`: no errors.
- Production build size: first-load JavaScript 98.5 KB gzip.

### Local security probes (production build served by `vite preview`)
- Headers present on `/`: CSP (with Trusted Types), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy, COOP, CORP. API responses carry `Cache-Control: no-store` and a CSP of `default-src 'none'`.
- Probed `/.git/HEAD`, `/.git/config`, `/.env`, `/.env.local`, `/package.json`, `/src/worker/index.ts`, `/wrangler.jsonc`, `/node_modules/hono/package.json`, `/migrations/0001_init.sql`, `/secrets/demo-credentials.json`, `/tsconfig.json`, `/vite.config.ts`: every request returned the 861-byte `index.html` (the single-page-app fallback), never a real file.
- Source maps in the build output: 0.

### Manual visual check
- Screenshots of landing, timer, employees and reports at phone (390 px) and desktop (1280 px) widths were reviewed; layouts, the bottom tab bar versus sidebar, running timers and the report with expanded records looked as specified.

### Not yet done (as of the end of this entry)
- Live deployment checks (TC-DEP-*), live header and probe checks, the Workers CPU measurement for PBKDF2, the git-history secret scan (no repository exists yet), bundle secret scan, and TC-PER-03 (restarting `npm run dev` and checking the local database persists).

### Deployment to Cloudflare (2026-10-29, approved step by step by the author)
- Created the production D1 database `worktime-db` (region EEUR). Applied `0001_init.sql` remotely. Seeded the 20 demo workspaces remotely: 20 organizations, 20 users, 140 employees, 3,019 entries (verified by a count query).
- First deploy to the default `workers.dev` address, then attached the custom domain `worktime.purcelalex.com` and redeployed. Wrangler disabled `workers.dev` and Preview URLs automatically because they are not set in `wrangler.jsonc`.
- **Live checks on `https://worktime.purcelalex.com`:**
  - HTTPS works; `Strict-Transport-Security` present (TC-DEP-01 passed). Security headers identical to the local build: CSP with Trusted Types, COOP, CORP, Permissions-Policy, Referrer-Policy, `X-Content-Type-Options`, `X-Frame-Options`.
  - The old `workers.dev` address now answers 404 (TC-DEP-02 passed: disabled).
  - Static probing (`/.git/HEAD`, `/.env`, `/package.json`, `/src/worker/index.ts`, `/wrangler.jsonc`, `/migrations/0001_init.sql`, `/secrets/demo-credentials.json`): every request returned the 861-byte `index.html` (TC-SEC-04 passed live).
  - API: `/api/auth/me` without a session returns 401 with `Cache-Control: no-store` and the API CSP; a login attempt with an unknown account returned 401 in about 0.6 s including the dummy PBKDF2 hash, with no CPU-limit error (this is the same work as a real password check on the free plan; a real login by the author is still needed to close TC-DEP-04). A POST with a foreign `Origin` returned 400.
  - `http://worktime.purcelalex.com/` answers 200 without redirecting to HTTPS: "Always Use HTTPS" is not enabled for the zone (recommended manual step, see `HOW_TO.md`).
  - `purcelalex.com` home page sets no cookies, so no domain-wide cookie reaches the subdomain (checked on one response only).
- After the deploy: re-migrated the local database (its id changed in `wrangler.jsonc`) and re-ran the end-to-end suite: **26 passed**.
- Still pending: TC-DEP-03 (two real demo accounts isolated on the live site) and TC-DEP-04 (a successful real login), both need the author to sign in with demo credentials; the git-history secret scan; the bundle secret scan.

## 2026-10-29 (later): GDPR and environment separation

- Added `docs/PRIVACY_GDPR.md`; added the physical demo/real environment separation rule to the private base prompt and `ARCHITECTURE.md`.
- Code: a daily retention job (`src/worker/cleanup.ts`, Cron Trigger `17 3 * * *`) deleting expired sessions and login-throttling rows older than 24 hours; a public `/privacy` page linked from the landing and login pages; a "fictional data only" notice inside demo workspaces and a hint in the add-employee dialog.
- `npx vitest run`: **59 passed** (added TC-GDPR-01 retention cleanup and an empty-database run). `npx playwright test`: **30 passed** (15 scenarios on phone and desktop; added TC-GDPR-02 privacy notice with axe and zero CSP violations, TC-GDPR-03 demo warnings). `npm audit`: 0. `oxlint`: clean. First-load JavaScript: 99.6 KB gzip.
- **Not deployed yet:** these changes exist locally only. The live site at `worktime.purcelalex.com` runs the previous version until the author approves a redeploy. The cron trigger is created on the next deploy.

### Redeploy with the GDPR changes (2026-10-29, approved by the author)
- `npm run deploy` succeeded (version `dbe0c8f0`); the Cron Trigger `17 3 * * *` is now registered.
- Live checks: `https://worktime.purcelalex.com/privacy` returns the privacy notice page; the new demo notice text is in the live bundle; security headers and the 401 on `/api/auth/me` are unchanged.
- TC-GDPR-04 (manual): `wrangler.jsonc` binds only the demo database `worktime-db`; there is no other database binding.
- The first scheduled run happens at 03:17 UTC; its effect is covered by TC-GDPR-01 locally and has not been observed live yet.

## 2026-10-30: pause, resume and delete employee

- Added migrations `0002_pause_resume.sql` and `0003_employee_soft_delete.sql`; API endpoints for pause, resume and delete; UI buttons Pause, Resume and Delete employee with a confirmation step; a "Deleted" badge in reports. Specification: `SPEC.md` section 11.
- API tests: **83 passed** (new: 14 for pause and resume including concurrent resumes, 10 for delete including history kept, 409 while a timer is open, name reuse, isolation).
- End-to-end: first runs failed: the server errored because the local database lacked the new migration (fixed: setup now migrates); the pause scenario failed on a label selector and then on a wrong expected record count (test errors, see `AI_LOG.md` entry 8); the delete scenario failed axe colour contrast on the danger button hover (a real defect, `AI_LOG.md` entry 7). After fixes: **34 passed** (17 scenarios on phone and desktop).
- `npm audit`: 0. `oxlint`: clean. First-load JavaScript: 99.96 KB gzip (the privacy page was moved to a lazy chunk to stay under 100 KB).
- **Not deployed.** The live site and its database are still at version 1. Deploying needs the two new migrations applied to the production database first.

### Deployment of pause, resume and delete employee (2026-10-30, approved by the author)
- Production data before the migrations: 20 organizations, 141 employees, 3,021 entries (one more employee and two more entries than the seed, from the author's own live testing).
- Applied `0002_pause_resume.sql` and `0003_employee_soft_delete.sql` to the production database, then deployed (version `43d1c5c0`).
- After the migrations: 141 employees and 3,021 entries (nothing lost), 3,021 entries marked `stopped`, 0 finished entries without a reason, 0 running.
- Live: `POST /api/employees/:id/timer/pause`, `.../resume` and `DELETE /api/employees/:id` exist (401 without a session); security headers unchanged; the new UI strings are in the live bundle. Signing in and using the new buttons on the live site has not been done by me (no access to the demo credentials); the author should try Pause/Resume and Delete employee in one demo account.

## 2026-10-30: GitHub preparation

- Added `scripts/scan-secrets.ts` (staged, tracked, history and directory modes), `.githooks/pre-commit`, `scripts/export-public.ts`, `.gitattributes`.
- First scan found 7 false positives (an example password written as `word-word-NN!` style in comments, the docs and unit tests, and a hash-format assertion). No real credential was found. Examples were rewritten to shapes the scanner does not flag, and the format assertion carries a `scan:allow` marker.
- Private repository created locally (commit `f8c7bf1`, 107 files): the scan of staged files, of the history (about 11,900 added lines) and the exact-match check against this machine's demo credentials were clean.
- Public export built from the allowlist (97 files, 441 KB, fresh history): scan clean; `npm ci`, `tsc -b` and 83 API and unit tests pass inside the export on its own; no personal e-mail, Cloudflare account id or production database id in it; no references to private documents.
- Nothing has been pushed to GitHub at this point.

## 2026-10-30: GitHub publication

- Published with GitHub Desktop: private `purcelalex/worktime-app` (`main`, one commit; 404 without login) and public `purcelalex/worktime-demo` (renamed from `worktime-demo-export`; 301 redirect from the old name).
- Public repository verified from outside by cloning it into a scratch folder: 97 files, 1 commit (`fbd6434`) identical to the local export; no private documents, secrets, credentials, hashes, production database id or custom-domain route; the secret scan (files and history, with exact-match of this machine's demo credentials) was clean.
- Public `main` is protected by the ruleset `protect-main`: the public API reports the active rules `deletion` and `non_fast_forward` (no force push, no deletion).
- Private `worktime-app`: the ruleset exists, but GitHub states it is not enforced on a private repository without a paid team plan. Accepted: single user, local copy, no force pushes by policy.
- Dependabot alerts, Dependabot security updates, dependency graph, Secret Protection and Push protection were On in the settings page the author reviewed. The settings of each repository are not visible from outside, so they are confirmed by the author's screenshots only.
- Rule for Dependabot pull requests on the public repository: do not merge them there; update the dependency in the private repository and re-export.
