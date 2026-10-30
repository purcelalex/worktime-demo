# AGENTS.md

Rules for AI agents (and people) working in this repository. The authoritative requirements are in the private base prompt, `docs/SPEC.md` and `docs/ARCHITECTURE.md`.

## Language
- **Everything in the repository is in English**: code, comments, UI text, commit messages, documents, test cases and results.
- Chat with the author is in Romanian. That never leaks into project files.

## Commands
```bash
npm install
npm run db:migrate:local     # apply migrations to the local D1
npm run seed:demo            # 20 demo workspaces (passwords go to secrets/, git-ignored)
npm run dev                  # Vite + Workers runtime, http://localhost:5173
npm test                     # Vitest: API and unit tests (real local D1)
npm run test:e2e             # Playwright on the production build (needs Chrome)
npm run typecheck && npm run lint
npm run build
```
Run `typecheck`, `test` and (for UI changes) `test:e2e` before saying a task is done, and log meaningful runs in `docs/TEST_LOG.md`.

## Code rules
- TypeScript strict. Match the surrounding style. No speculative abstractions.
- **Tenant isolation:** every tenant-owned query goes through `src/worker/db/repo.ts` and takes `orgId` from the session, never from the request.
- **Time:** UTC epoch milliseconds; the server clock is authoritative.
- **Validation:** zod schemas live in `src/shared/schemas.ts` and are used on the server only. The browser imports **types** from there and constants from `src/shared/limits.ts` (importing zod values into the browser breaks the Trusted Types policy).
- **No** `innerHTML`, `dangerouslySetInnerHTML`, `eval`, inline scripts or styles, third-party scripts, fonts or analytics.
- Add a dependency only with a written reason in `docs/ARCHITECTURE.md` (appendix). `npm audit` must stay at 0.
- UI strings go in `src/web/strings.ts`.
- Optional modules (`modules/demo`, later `modules/superadmin`) are reached only through the registry files, so editions can leave them out. Core code never imports from `modules/`.

## Secrets and personal data
- Never commit secrets, passwords, hashes or real personal data. `secrets/`, `.dev.vars*`, `.env*` and `*.generated.sql` are git-ignored.
- Never read, print or repeat the demo credentials in `secrets/`. Use the local-only test account from `tests/e2e/constants.ts` for manual checks.
- Store only what time tracking needs (name, optional position, task text). Never ask for or store national identity numbers, addresses, phones or documents.
- Do not link this app from, or edit, `purcelalex.com`.

## Testing and honesty
- Tests are recorded in English in `docs/TEST_SCENARIOS.md` and `docs/TEST_LOG.md`, including failures.
- When AI-generated code or a spec contains a real mistake, append an entry to `docs/AI_LOG.md` (what, why wrong, how found, fix, lesson). Never invent prompts, errors, models or results.

## Ask first
Creating cloud resources, deploying, changing DNS, creating or publishing a GitHub repository, committing, and anything outward-facing need the author's explicit approval.
