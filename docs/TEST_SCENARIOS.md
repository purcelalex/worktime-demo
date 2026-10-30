# Test Scenarios

Case IDs match `docs/SPEC.md` section 8. Status values: **Automated** (runs in `npm test` or `npm run test:e2e`), **Manual** (done by hand and recorded in `TEST_LOG.md`), **Pending** (not done yet).

## Employees (API)
| ID | Scenario | Status |
|---|---|---|
| TC-EMP-01 | Add a valid employee | Automated |
| TC-EMP-02 | Reject an empty name | Automated |
| TC-EMP-03 | Reject a name over 100 characters | Automated |
| TC-EMP-04 | Reject a duplicate name (case-insensitive) | Automated |
| TC-EMP-05 | Position optional and trimmed | Automated |
| TC-EMP-06 | 50-employee cap for a demo organization | Automated |
| TC-EMP-07 | List ordered by name | Automated |

## Timer (API)
| ID | Scenario | Status |
|---|---|---|
| TC-TMR-01 | Start then stop gives the correct duration | Automated |
| TC-TMR-02 | Task description required (empty, whitespace, over 200) | Automated |
| TC-TMR-03 | Start while running returns 409 | Automated |
| TC-TMR-04 | Stop while idle returns 409 | Automated |
| **TC-TMR-05** | **Restart: stop then start creates a second independent entry** | Automated |
| TC-TMR-06 | Two employees run timers at once | Automated |
| TC-TMR-07 | Concurrent starts leave exactly one running entry | Automated |
| TC-TMR-08 | Unknown employee gives 404 | Automated |

### Pause and resume (API)
| ID | Scenario | Status |
|---|---|---|
| TC-TMR-09 | Pausing keeps the task and stops counting | Automated |
| TC-TMR-10 | Resume continues the same task from the time already worked | Automated |
| TC-TMR-11 | Time spent paused never reaches the report | Automated |
| TC-TMR-12 | Pausing when nothing runs returns 409 (also pausing twice) | Automated |
| TC-TMR-13 | Resuming when nothing is paused returns 409 | Automated |
| TC-TMR-14 | Starting a new task while paused returns 409 | Automated |
| TC-TMR-15 | Stopping a paused timer ends the task without adding time | Automated |
| TC-TMR-16 | Concurrent resumes create exactly one running segment | Automated |
| TC-TMR-17 | A paused and a running employee are listed together | Automated |
| TC-ISO-03 | Another organization cannot pause or resume (404) | Automated |

### Delete employee (API)
| ID | Scenario | Status |
|---|---|---|
| TC-EMP-08 | Deleted employee leaves the list | Automated |
| TC-EMP-09 | History stays in the report, marked as deleted; totals unchanged | Automated |
| TC-EMP-10 | A deleted employee with no records in the period is not listed | Automated |
| TC-EMP-11 | Refused (409) while a timer is running or paused; allowed after stopping | Automated |
| TC-EMP-12 | Deleting twice or an unknown id gives 404 | Automated |
| TC-EMP-13 | The name can be reused after deletion; active duplicates still rejected | Automated |
| TC-EMP-14 | A deleted employee can no longer start a timer | Automated |
| TC-ISO-04 | Another organization cannot delete this employee (404) | Automated |

## Reports (API)
| ID | Scenario | Status |
|---|---|---|
| TC-REP-01 | Totals equal the sum of entries | Automated |
| **TC-REP-02** | **Empty report: employees without entries show zero** | Automated |
| TC-REP-03 | Organization without employees returns an empty list | Automated |
| TC-REP-04 | Period with no overlapping entries returns zeros | Automated |
| TC-REP-05 | Entry crossing the period start is clipped | Automated |
| TC-REP-06 | Entry crossing the period end is clipped | Automated |
| TC-REP-07 | Running entry counts up to now | Automated |
| TC-REP-08 | `from` after `to` rejected | Automated |
| TC-REP-09 | Range over 366 days and bad parameters rejected | Automated |
| TC-REP-10 | Other organizations' entries never appear | Automated |

## Persistence
| ID | Scenario | Status |
|---|---|---|
| TC-PER-01 | Data written by one data client is read by a fresh one | Automated |
| TC-PER-02 | A running timer survives and its elapsed time continues | Automated |
| TC-PER-03 | Local dev database survives restarting `npm run dev` | Pending (manual) |
| TC-PER-04 | A new employee is still there after a full page reload | Automated (e2e) |

## Authentication and isolation
| ID | Scenario | Status |
|---|---|---|
| TC-AUT-01 | Valid login sets the cookie | Automated |
| TC-AUT-02 | Wrong password and unknown user give the same response | Automated |
| TC-AUT-03 | Rate limit after 5 failures (plus 20 per IP, window expiry) | Automated |
| TC-AUT-04 | Protected endpoints return 401 without a session | Automated |
| TC-AUT-05 | Logout invalidates the session | Automated |
| TC-AUT-06 | Expired session rejected | Automated |
| TC-AUT-07 | Cookie is host-only, Secure, HttpOnly, SameSite=Lax | Automated |
| TC-ISO-01 | Organization A cannot read or act on B's data (404) | Automated |
| TC-ISO-02 | The session decides the organization, never the request | Automated |

## Security
| ID | Scenario | Status |
|---|---|---|
| TC-SEC-01 | Security headers on API success and error responses | Automated |
| TC-SEC-02 | API CSP has no unsafe directives | Automated |
| TC-SEC-03 | Foreign or missing Origin and wrong content type rejected | Automated |
| TC-SEC-04 | Static probing returns no real file | Manual: local and live done |
| TC-SEC-05 | No source maps in production | Manual local (done) |
| TC-SEC-06 | No secrets in the bundle (scan) | Pending |
| TC-SEC-07 | `npm audit` at 0 | Manual (done) |
| TC-SEC-08 | Secret scan of the git history is clean | Pending (no repository yet) |
| TC-SEC-09 | No credential or hash in the repository | Pending (no repository yet) |
| TC-SEC-10 | Browser reports zero CSP violations | Automated (e2e) |

## UI (Playwright on the production build, desktop 1280×800 and phone 390×844)
| ID | Scenario | Status |
|---|---|---|
| TC-UI-01 | Landing button leads to the test-mode login | Automated |
| TC-UI-02 | Login errors are generic | Automated |
| TC-UI-03 | Full flow: add, start, stop, restart, report | Automated |
| TC-UI-04 | Empty report shows the empty state | Automated |
| TC-UI-05 | Bottom tab bar on phone, sidebar on desktop | Automated |
| TC-UI-06 | No horizontal scroll at 360 px | Automated |
| TC-UI-07 | Dialog works with the keyboard only; focus returns | Automated |
| TC-UI-08 | axe finds no serious or critical issues (landing, login, timer, reports, employees) | Automated |
| TC-UI-09 | Zero CSP violations | Automated (see TC-SEC-10) |
| TC-UI-10 | App shell loads offline | Automated |
| TC-UI-11 | Duplicate employee shows an inline error | Automated |
| TC-UI-12 | Logout ends the session; protected pages redirect to login | Automated |
| TC-UI-13 | Pause freezes the clock, resume continues it, stop from paused ends the task | Automated |
| TC-UI-14 | Delete employee: choose, confirm (No keeps, Yes deletes), history kept in the report | Automated |

## Privacy and GDPR
| ID | Scenario | Status |
|---|---|---|
| TC-GDPR-01 | Daily cleanup deletes expired sessions and old throttling rows, keeps live data | Automated |
| TC-GDPR-02 | Privacy notice reachable, accessible, states the key facts, zero CSP violations | Automated (e2e) |
| TC-GDPR-03 | Demo workspace warns against entering real personal data | Automated (e2e) |
| TC-GDPR-04 | Demo Worker has no binding to any real-data database (checked in `wrangler.jsonc` before every deploy) | Manual: done 2026-10-29 |

## Deployment (live)
| ID | Scenario | Status |
|---|---|---|
| TC-DEP-01 | HTTPS with HSTS at `worktime.purcelalex.com` | Manual: done (no HTTP to HTTPS redirect yet) |
| TC-DEP-02 | The `workers.dev` address behaves the same or is disabled | Manual: done (disabled, 404) |
| TC-DEP-03 | Two demo accounts are isolated on the live site | Pending (needs the author to sign in) |
| TC-DEP-04 | Login (PBKDF2) works within the Workers CPU limit of the chosen plan | Partly done: unknown-account path (same hashing work) OK on the free plan; a real login is pending |
