# Privacy and GDPR

Status: DRAFT, 2026-10-29. This document is an engineering and operational guide, **not legal advice**. Before the application processes real people's data (Phase 3 and later), the author must have a qualified lawyer review it, in particular for the Moldovan data protection law (Law 133/2011) and, where users or employers are in the EU, the GDPR.

## 1. Two completely separate environments

Sensitive data must never sit next to the demo. The demo is semi-public: its passwords are handed to many evaluators. Therefore the separation is **physical**, not only logical (an `org_id` filter is a safeguard, not a wall).

| | Demo environment (exists today) | Real environment (Phase 3, Clean edition) |
|---|---|---|
| Purpose | Show what the application can do | Process a real organization's real data |
| Data | Fictional only | Real employees and work records |
| Address | `worktime.purcelalex.com` | Its own domain, chosen by the owner |
| Worker | `employees-working-time` | A separate Worker, deployed from the Clean edition |
| Database | D1 `worktime-db` (demo data only) | A separate D1 database, never bound to the demo Worker |
| Secrets and tokens | Demo-only | Separate, held by the real owner |
| Accounts | 20 shared test accounts | Individual accounts, magic link and passkeys |
| Code | Demo edition (public export) | Clean edition, without demo or Super Admin code |

Consequences:
- A demo user, or someone who obtains a demo password, can only ever reach the demo database. The demo Worker has no binding to, and no credentials for, the real database. A bug in tenant filtering inside the demo cannot expose real data because the real data is not there.
- Real data is never copied into the demo, and demo data is never imported into the real environment.
- The Super Admin cabinet (Phase 2) must not become a bridge. For the real environment it shows **aggregates only**, delivered through a one-way, read-only statistics channel that carries counts, never records. This is decided when Phase 2 is designed and recorded here.
- Until the real environment exists, the demo database holds **no** real personal data.

## 2. What personal data the demo processes

| Data | Whose | Why | Where | How long |
|---|---|---|---|---|
| Demo account name, password hash | The evaluator | Sign in | D1 | Until the account is disabled or rotated |
| Session token (stored only as a hash), created and expiry time | The evaluator | Keep the sign-in | D1 | Expires after 7 days; expired rows are deleted daily |
| Client IP address and failed-attempt count (inside a login throttling key) | The evaluator | Stop password guessing | D1 | 15-minute window; rows older than 24 hours are deleted daily |
| Employee names, positions, task texts, time entries | **Fictional** people | Demonstrate the product | D1 | Until the workspace is reset |
| Request logs (IP, URL, time, status) | Visitors | Operate and secure the service | Cloudflare platform logs | Per Cloudflare's retention |
| One strictly necessary cookie (`__Host-session`) | The evaluator | Sign in | Browser | 7 days |

Not collected: analytics, advertising identifiers, third-party scripts or fonts, national identity numbers, addresses, phone numbers, birth dates, documents. There are no tracking cookies, so no cookie consent banner is required for the strictly necessary cookie.

Evaluators are told, on the login page, inside the app and in the privacy notice, **not to enter real personal data**: fictional names only.

## 3. Principles applied (GDPR Article 5)

- **Lawfulness, fairness, transparency:** a public privacy notice at `/privacy` in plain English.
- **Purpose limitation:** data is used only for the purpose in the table above.
- **Data minimization:** only a name, an optional position and a task text for employees; nothing else (see `ARCHITECTURE.md`).
- **Accuracy:** users can correct their records (editing arrives in Phase 3 with the audit log).
- **Storage limitation:** the retention periods above; automated deletion of expired sessions and old throttling rows runs daily.
- **Integrity and confidentiality:** the security design in `ARCHITECTURE.md` section 6.
- **Accountability:** this document, the test log, and the records below.

## 4. Roles in the real environment (Phase 3)

- The **customer organization** is the **controller** of its employees' data: it decides why and how the data is used and needs its own lawful basis (often legitimate interest or a legal obligation for working-time records, depending on the country).
- The author, or whoever operates the hosted service, acts as **processor** and must sign a **Data Processing Agreement** (GDPR Article 28) with each customer.
- If the software is sold as a copy that the buyer runs, the buyer is the controller and the processor relationship does not arise; the Clean edition verification package is meant to prove nothing leaves the buyer's environment.
- **Sub-processors:** Cloudflare (hosting and database), and the email provider for magic links. Keep a list, sign or accept their data processing terms, and tell customers about changes.
- **Employee monitoring** deserves extra care: employees must be informed (transparency), the tracking must be proportionate, and some countries require consulting employee representatives. The customer is responsible, and the product should make the information duty easy (a short notice employees can read).

## 5. Data subject rights (real environment)

Build these into Phase 3 so they are a button, not a favor:

| Right | Product feature |
|---|---|
| Access, portability (Art. 15, 20) | Export an employee's records as CSV or JSON |
| Rectification (Art. 16) | Edit entries, with an audit trail |
| Erasure (Art. 17) | Delete or anonymize an employee; delete an organization and everything in it. The Phase 1 "Delete employee" button is only a soft delete (hidden from lists, history kept), so it does **not** satisfy an erasure request |
| Restriction, objection (Art. 18, 21) | Deactivate an employee without deleting history, on request |
| Respond within one month | Documented procedure and a named contact |

For the demo, the evaluator can ask the author to delete or reset their account and workspace at any time.

## 6. Security measures (Art. 32) in one place

Data minimization, tenant isolation with tests, hashed passwords and session tokens, strict CSP and the other security headers, host-only HttpOnly cookies, login rate limiting, TLS everywhere with HSTS, point-in-time database recovery, dependency auditing, no third-party scripts, and the physical separation in section 1. Details and tests: `ARCHITECTURE.md`, `TEST_SCENARIOS.md`, `TEST_LOG.md`.

## 7. Transfers and location

D1 is hosted by Cloudflare; the current database was created in the Eastern Europe region. Cloudflare is a US company, so for a real EU customer the transfer rules (for example the EU-US Data Privacy Framework or standard contractual clauses in Cloudflare's data processing terms) apply, and the database location can be restricted by jurisdiction. The author must choose and document the location for each real deployment.

## 8. Breach procedure

1. Contain: rotate secrets, disable accounts, take the affected part offline if needed.
2. Assess what data and whose.
3. For the real environment: the processor informs the controller without undue delay; the controller notifies the supervisory authority within **72 hours** when there is a risk to people, and tells the affected individuals when the risk is high.
4. Record the incident, its cause and the fix in a breach register. Keep a copy in `docs/`.

## 9. Records and reviews

- A record of processing activities (a short table, section 2, extended per real customer).
- A data protection impact assessment (DPIA) is likely worthwhile for systematic employee monitoring; decide with the lawyer.
- Review this document at every phase, and whenever a new data type, vendor or feature touches personal data.

## 10. Checklist before the first real customer

- [ ] Lawyer reviewed this document, the privacy notice and the DPA template.
- [ ] A separate Worker, database, domain, secrets and Cloudflare tokens for the real environment.
- [ ] Verification package for the Clean edition passed (the private base prompt section 11).
- [ ] Export, erase and deactivate features built and tested (section 5).
- [ ] Sub-processor list and database location documented.
- [ ] Breach procedure rehearsed once.
- [ ] A named privacy contact published in the privacy notice.
