# How-to Guide

## Run locally
1. `npm install`
2. `npm run db:migrate:local`
3. `npm run seed:demo` (creates 20 demo workspaces; passwords are written to `secrets/demo-credentials.md`, git-ignored)
4. `npm run dev` and open http://localhost:5173

Local data lives in `.wrangler/state` and survives restarts. Delete that folder to start over.

## Test
- `npm test`: API and unit tests.
- `npm run test:e2e`: builds the app, serves the production build on port 4173 and runs the browser tests on a phone-size and a desktop-size viewport. It creates a local-only test account first (`npm run e2e:setup`).

## Manage demo accounts
```bash
npm run seed:demo -- --reset 3     # restore workspace 3 to its initial state
npm run seed:demo -- --rotate 3    # issue a new password for test-account_3
npm run seed:demo -- --print-only  # only write the SQL, do not run it
npm run seed:demo -- --remote      # seed the production database (after deployment)
```
Hand out one account per evaluator through a private channel. After an evaluation, rotate that account's password or reset the workspace.

## Deploy to Cloudflare (one-time setup, done by the author)
These steps create cloud resources and change DNS, so they are done only with the author's approval.

1. **Account safety first:** turn on two-factor authentication for the Cloudflare and GitHub accounts and keep the recovery codes offline.
2. `npx wrangler login`
3. Create the database: `npx wrangler d1 create worktime-db`. Copy the returned `database_id` into `wrangler.jsonc` (replace the placeholder).
4. Apply migrations to production: `npm run db:migrate:remote`
5. Seed the demo workspaces: `npm run seed:demo -- --remote`
6. Deploy: `npm run deploy`
7. **Custom domain:** in the Cloudflare dashboard open Workers & Pages, select `employees-working-time`, then Settings, Domains & Routes, Add, Custom domain, and enter `worktime.purcelalex.com`. This works automatically only if the zone `purcelalex.com` is on Cloudflare; otherwise add a CNAME at the current DNS provider as the dashboard instructs.
8. Check whether `purcelalex.com` sets cookies for the whole domain (`Domain=.purcelalex.com`); the browser would send those to the subdomain as well.
9. **Do not link** the app from `purcelalex.com`.
   - Done on 2026-10-29: the database `worktime-db` exists, migrations and the demo seed are applied, and the app is deployed at `worktime.purcelalex.com`. `workers.dev` and Preview URLs are disabled (not set in `wrangler.jsonc`).
   - Recommended manual step: in the Cloudflare dashboard, zone `purcelalex.com`, SSL/TLS, Edge Certificates, turn on **Always Use HTTPS** (plain HTTP currently answers 200 instead of redirecting). It is a zone-wide setting, so it also applies to the main site.
10. Verify from outside: HTTPS and HSTS, the security headers, the probing list in `docs/SPEC.md` (TC-SEC-04), sign in with two different demo accounts and confirm they are isolated, and record the results in `docs/TEST_LOG.md`.
11. Measure that login (PBKDF2, 100,000 iterations) completes within the Workers CPU limit of the chosen plan; if it fails on the free plan, the paid plan is needed. Record the plan and the result.

## Two GitHub repositories: private development, public demo

- **Private** (`worktime-app`): the complete project with its full history, including the base prompt, the strategy documents and every future module. Nobody but the author has access.
- **Public** (`worktime-demo`): a generated export of the Demo edition with a fresh history. It never contains the private history.

### Safety net (already set up)
- `.gitignore` keeps `secrets/`, `.dev.vars*`, `.env*`, `*.generated.sql` and `.wrangler/` out of git.
- `.githooks/pre-commit` runs `scripts/scan-secrets.ts --staged` and blocks a commit that contains a secret, a password hash, the shape of a generated demo password, a token, or a forbidden file. Enable it once per clone: `git config core.hooksPath .githooks`.
- `npx tsx scripts/scan-secrets.ts --history` scans every line ever committed. Run it before every push.
- The scanner also looks for the exact demo passwords and hashes stored in `secrets/demo-credentials.json` on this machine. It never prints a secret, only the file, line and rule.

### Publishing a new public version
1. Commit and test in the private repository.
2. `npx tsx scripts/export-public.ts` builds `../worktime-demo-export` from an allowlist (see the script), rewrites the production database id and the custom domain route, replaces references to private documents, and runs the secret scan. It stops if anything is found.
3. In `../worktime-demo-export`: review `git status`, commit, and push to the public repository.
4. To change what is public, edit the allowlist in `scripts/export-public.ts`; never copy files by hand.

### One-time GitHub setup (done by the author on github.com)
1. Turn on two-factor authentication for the GitHub account and keep the recovery codes offline.
2. Create `worktime-app` as **Private** and `worktime-demo` as **Public**, both **empty** (no README, no .gitignore, no license).
3. In each repository: Settings, Code security: turn on Dependabot alerts, Dependabot security updates, Secret scanning and Push protection.
4. In each repository: Settings, Rules, Rulesets, New branch ruleset `protect-main`: Active, include the default branch, Restrict deletions and Block force pushes (do not require pull requests). On a free account the ruleset is enforced on the public repository only; GitHub shows a banner on private ones and does not enforce it there.
5. Do not click "Create dependabot.yml" or the advanced CodeQL setup in the GitHub pages: they commit files on GitHub and the local copies diverge. Do not merge Dependabot pull requests on the public repository; update dependencies in the private repository and run the export again.
6. Check collaborators, deploy keys, webhooks and authorized apps; the private repository should have no collaborators.
