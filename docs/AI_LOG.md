# AI Log

An honest record of how AI was used and of the real mistakes found in AI-generated code or specifications. Nothing here is invented: each entry comes from an actual event during development. The README summarizes this file.

## Tools and models

| Tool | Model | Used for |
|---|---|---|
| Claude Code (desktop app) | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | Specification, architecture, all application code, tests, documentation, debugging |

The author directed the work in chat (in Romanian), approved every document before implementation, and reviewed results. Prompts were written in Romanian; they are shown here translated to English.

## Example prompts (translated)

1. "Read the assignment screenshots, take into account what we agreed, and write the base PROMPT. Pick the simplest stack for an MVP of this kind that deploys on Cloudflare and works beautifully."
2. "Make the architecture more contemporary and better for our future use. As good as possible for the web and mobile user interface, and meeting today's security requirements. Use green and white like Expenses Manager."
3. "Write the final thesis of our app: the stack, the security, and how we deliver it to people who want to test it. If we give the repo on GitHub, it must not give access to the real part of the code. Is that possible?"
4. "The SPEC is approved. Start the implementation of Phase 1." (The assistant then built the API, tests, seed script and UI in small steps, running the tests after each step.)
5. "Do NOT link worktime.purcelalex.com from purcelalex.com. The app must have no visual or link connection to my site." (Recorded as a standing rule.)

## Mistakes found and fixed

### 1. Deprecated test package in the specification
- **What was generated:** the private base prompt named `@cloudflare/vitest-pool-workers` as the Workers test integration.
- **What was wrong:** the package is deprecated and renamed `@cloudflare/vitest-plugin`; the old one also did not accept the newest Vitest.
- **How it was found:** `npm install` failed with a peer-dependency conflict (Vitest 5 versus the pool's Vitest 4 requirement), then the package README showed the deprecation notice.
- **Fix:** switched to `@cloudflare/vitest-plugin` and pinned Vitest to the 4.x line. The specification files were corrected.
- **Lesson:** verify package names and versions against the registry before writing them into a spec.

### 2. Login rate limit too strict for shared networks
- **What was generated:** the specification limited logins to 5 failures per 15 minutes per username **and per IP**.
- **What was wrong:** when several evaluators at one company (one public IP) test different demo accounts, a few typos would lock all of them out.
- **How it was found:** while writing the authentication tests, the shared test IP hit 429 and cascaded into unrelated failures (8 failing tests), which exposed the real-world problem.
- **Fix:** limits are now 5 failures per username and **20 per IP** (`src/worker/lib/rate-limit.ts`); tests use a distinct client IP per test; a new test covers the IP limit.
- **Lesson:** a limit that is correct in isolation can be wrong for the people who actually use the system.

### 3. Validation library broke the strict browser security policy
- **What was generated:** the UI imported a limits constant from the same file as the zod schemas, so the whole of zod was shipped to the browser.
- **What was wrong:** zod probes for `eval` support with `new Function("")`. Under the strict Content Security Policy with Trusted Types this produced a policy violation on every page load, and the bundle was larger than needed.
- **How it was found:** the end-to-end test that collects `securitypolicyviolation` events failed on the production build (the dev server has no CSP, so manual checks would have missed it).
- **Fix:** moved the shared constants to `src/shared/limits.ts` with no imports; the browser now imports only types and constants. Zero violations, and the first-load bundle fell from 126.6 KB to 98.5 KB gzip.
- **Lesson:** test security headers on the production build, not on the dev server.

### 4. Dialog focus did not move to the form field
- **What was generated:** the add-employee and start-timer dialogs used React's `autoFocus` on the first field.
- **What was wrong:** the field mounts before the native `<dialog>` is opened, so `autoFocus` ran too early; the browser then focused the close button instead. Keyboard and screen-reader users landed on the wrong control.
- **How it was found:** the keyboard-only end-to-end test (TC-UI-07) failed: the "Full name" field was not focused after opening the dialog.
- **Fix:** the dialog component now focuses the element marked `data-autofocus` right after `showModal()`.
- **Lesson:** framework conveniences can run at the wrong moment around native elements; test with the keyboard.

### 5. Unused dependency with known vulnerabilities
- **What was generated:** `drizzle-kit` was installed "for migrations".
- **What was wrong:** migrations are hand-written SQL, so it was unused, and it pulled in four moderate vulnerabilities (old `esbuild` through `@esbuild-kit`).
- **How it was found:** `npm audit` reported 4 moderate vulnerabilities.
- **Fix:** removed the package; `npm audit` now reports 0.
- **Lesson:** install only what is used.

### 6. Smaller issues
- A `BufferSource` type was missing in the Node-side TypeScript project (the password helper is shared with the seed script); fixed by typing the salt as `Uint8Array<ArrayBuffer>`.
- The seed script first spawned Wrangler through a shell, which triggers a Node deprecation warning about unescaped arguments; it now runs Wrangler through Node directly.
- One end-to-end test used `.last()` and picked a hidden desktop table cell on the phone layout. This was a test bug, not an application bug; the selector now filters to visible elements.
- A lint warning flagged a `fetch` call that passed `body: undefined` with `GET`; the options are now built per method.

## Decisions made with AI help that are worth explaining

- Native `<dialog>` instead of a UI library: focus trap, Escape, inert background and focus return come from the browser.
- A hand-built bar chart instead of a chart library: smaller, sharper, and no extra inline-style concerns under the CSP.
- A plain `fetch` wrapper with shared TypeScript types instead of the Hono RPC client: fewer moving parts.

## 2026-10-30: pause, resume and delete employee

### 7. Danger button failed colour contrast on hover
- **What was generated:** the red "danger" button used `hover:opacity-90` for its hover state.
- **What was wrong:** lightening a button with opacity blends its white text and red background with the page; contrast fell to 4.11:1, below the 4.5:1 WCAG AA minimum. It only appears while the pointer rests on the button, which is exactly where the pointer is after clicking the previous button in the delete dialog.
- **How it was found:** the axe check in the new delete-employee end-to-end test (TC-UI-14) failed. My first guess (a dialog still fading in) was wrong; printing axe's own message showed the blended colours, which pointed to the hover state.
- **Fix:** a darker red token (`--color-danger-strong`) for hover and pressed states; the test now also waits for finite animations before measuring contrast.
- **Lesson:** never express a state by changing opacity; use a defined colour. Read the tool's message before guessing at a cause.

### 8. Smaller issues
- The end-to-end test for pause expected 3 records, but a task paused twice produces 2 work segments (the last pause closes the second segment, and stopping from the paused state adds none). The application was right; the test's arithmetic was wrong.
- The Paused/Running label shared an element with the "Paused at 10:12" text, so the test could not select it reliably; the label now has its own element, which also reads better for assistive technology.
- The end-to-end setup assumed the local database was already migrated; after the new migration the server failed. The setup now applies migrations before every run.
