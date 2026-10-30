/**
 * Creates (or resets) a local-only test organization and account for the
 * end-to-end tests: an empty demo-kind organization with the user from
 * tests/e2e/constants.ts. Local database only.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../src/worker/lib/password'
import { E2E_PASSWORD, E2E_USERNAME } from '../tests/e2e/constants'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SQL_FILE = resolve(ROOT, 'secrets', 'e2e-setup.generated.sql')

const hash = await hashPassword(E2E_PASSWORD)
const now = Date.now()
const sql = `
DELETE FROM sessions WHERE user_id = 'e2e-user-id';
DELETE FROM time_entries WHERE org_id = 'e2e-org';
DELETE FROM employees WHERE org_id = 'e2e-org';
DELETE FROM login_attempts;
INSERT OR IGNORE INTO organizations (id, name, kind, created_at) VALUES ('e2e-org', 'E2E Test Organization', 'demo', ${now});
INSERT INTO users (id, org_id, username, password_hash, role, is_active, created_at)
  VALUES ('e2e-user-id', 'e2e-org', '${E2E_USERNAME}', '${hash}', 'admin', 1, ${now})
  ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, is_active = 1;
`
mkdirSync(resolve(ROOT, 'secrets'), { recursive: true })
writeFileSync(SQL_FILE, sql)

const wrangler = resolve(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const run = spawnSync(process.execPath, [wrangler, 'd1', 'execute', 'DB', '--local', '--file', SQL_FILE], {
  cwd: ROOT,
  stdio: 'inherit',
})
process.exit(run.status ?? 1)
