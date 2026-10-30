/**
 * Seeds the 20 demo workspaces (Demo edition module).
 *
 *   npm run seed:demo                      seed all 20 into the local database
 *   npm run seed:demo -- --remote          seed all 20 into the production database
 *   npm run seed:demo -- --reset 3         restore workspace 3 to its initial state (fresh history)
 *   npm run seed:demo -- --rotate 3        issue a new password for test-account_3
 *   npm run seed:demo -- --print-only      only write the SQL file, do not run it
 *
 * Passwords are generated here and kept ONLY in git-ignored files under secrets/.
 * Nothing that identifies a credential (password or hash) is ever committed.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../src/worker/lib/password'
import { PASSWORD_SYMBOLS, WORDS } from './demo-words'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SECRETS = resolve(ROOT, 'secrets')
const CREDENTIALS_JSON = resolve(SECRETS, 'demo-credentials.json')
const CREDENTIALS_MD = resolve(SECRETS, 'demo-credentials.md')
const SQL_FILE = resolve(SECRETS, 'seed.generated.sql')

const ACCOUNTS = 20
const EMPLOYEES_PER_ORG = 7
const HISTORY_DAYS = 14


const FIRST_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Quinn', 'Avery', 'Rowan',
  'Dana', 'Elliot', 'Frankie', 'Harper', 'Indigo', 'Jamie', 'Kai', 'Lane', 'Marlowe', 'Noel',
]
const LAST_NAMES = [
  'Brightwater', 'Colefield', 'Dunmore', 'Everhart', 'Fairbanks', 'Glenwood', 'Hollowell', 'Ironside', 'Juniper', 'Kingsley',
  'Larkspur', 'Montrose', 'Northcott', 'Oakridge', 'Pennywell', 'Quillfeather', 'Ravenscroft', 'Stonebridge', 'Thornbury', 'Underhill',
]
const POSITIONS = ['Developer', 'Designer', 'Support Specialist', 'Analyst', 'Project Manager', 'QA Engineer', 'Operations']
const TASKS = [
  'Code review', 'Client call', 'Writing documentation', 'Bug triage', 'Sprint planning', 'Design review',
  'Customer support tickets', 'Weekly report', 'Refactoring', 'Team sync', 'Writing tests', 'Deployment checks',
  'Requirements analysis', 'Onboarding session', 'Data cleanup', 'Prototype work', 'Release notes', 'Monitoring alerts',
]

interface Credential {
  username: string
  password: string
  hash: string
}
type CredentialStore = Record<string, Credential>

// ---- small deterministic PRNG so each workspace is reproducible ----
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! % max
}

/** Two words, two digits and a symbol, for example "word-word-NN!" (12+ characters). */
function generatePassword(): string {
  const a = WORDS[randomInt(WORDS.length)]!
  let b = WORDS[randomInt(WORDS.length)]!
  while (b === a) b = WORDS[randomInt(WORDS.length)]!
  const digits = String(10 + randomInt(90))
  return `${a}-${b}-${digits}${PASSWORD_SYMBOLS[randomInt(PASSWORD_SYMBOLS.length)]}`
}

const q = (value: string) => `'${value.replaceAll("'", "''")}'`

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const valueOf = (name: string): number | undefined => {
    const i = argv.indexOf(name)
    if (i === -1) return undefined
    const n = Number(argv[i + 1])
    if (!Number.isInteger(n) || n < 1 || n > ACCOUNTS) {
      throw new Error(`${name} needs a workspace number from 1 to ${ACCOUNTS}`)
    }
    return n
  }
  return {
    remote: flags.has('--remote'),
    printOnly: flags.has('--print-only'),
    reset: valueOf('--reset'),
    rotate: valueOf('--rotate'),
  }
}

function loadCredentials(): CredentialStore {
  return existsSync(CREDENTIALS_JSON) ? (JSON.parse(readFileSync(CREDENTIALS_JSON, 'utf8')) as CredentialStore) : {}
}

/** Fictional employees for workspace n: a fixed, reproducible pick. */
function employeesFor(n: number) {
  const rand = mulberry32(1000 + n)
  const used = new Set<string>()
  const result: { id: string; fullName: string; position: string }[] = []
  while (result.length < EMPLOYEES_PER_ORG) {
    const fullName = `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`
    if (used.has(fullName)) continue
    used.add(fullName)
    result.push({
      id: `demo-emp-${n}-${result.length + 1}`,
      fullName,
      position: POSITIONS[result.length % POSITIONS.length]!,
    })
  }
  return result
}

/** About two weeks of weekday history, 08:00 to 18:00 UTC, no overlaps, nothing running. */
function entriesFor(n: number, employeeId: string, employeeIndex: number, now: number) {
  const rand = mulberry32(n * 7919 + employeeIndex * 104729)
  const MIN = 60_000
  const todayUtc = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate())
  const rows: { id: string; description: string; startedAt: number; stoppedAt: number }[] = []
  for (let d = HISTORY_DAYS; d >= 1; d--) {
    const day = todayUtc - d * 24 * 60 * MIN
    const weekday = new Date(day).getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    if (rand() < 0.12) continue // a day without entries
    const count = 1 + Math.floor(rand() * 4)
    let cursor = day + (8 * 60 + Math.floor(rand() * 4) * 15) * MIN
    const end = day + 18 * 60 * MIN
    for (let i = 0; i < count; i++) {
      const duration = (1 + Math.floor(rand() * 12)) * 15 * MIN // 15 minutes to 3 hours
      if (cursor + duration > end) break
      rows.push({
        id: `demo-te-${n}-${employeeIndex}-${d}-${i}`,
        description: TASKS[Math.floor(rand() * TASKS.length)]!,
        startedAt: cursor,
        stoppedAt: cursor + duration,
      })
      cursor += duration + Math.floor(rand() * 4) * 15 * MIN
    }
  }
  return rows.map((r) => ({ ...r, employeeId }))
}

function insertBatches(table: string, columns: string, rows: string[], size = 50): string[] {
  const out: string[] = []
  for (let i = 0; i < rows.length; i += size) {
    out.push(`INSERT OR IGNORE INTO ${table} (${columns}) VALUES\n${rows.slice(i, i + size).join(',\n')};`)
  }
  return out
}

function buildSql(numbers: number[], store: CredentialStore, resetNumber: number | undefined, now: number): string {
  const sql: string[] = ['-- Generated by scripts/seed-demo.ts. Contains password hashes: never commit.']
  for (const n of numbers) {
    const cred = store[String(n)]!
    const orgId = `demo-org-${n}`
    if (resetNumber === n) {
      sql.push(
        `DELETE FROM time_entries WHERE org_id = ${q(orgId)};`,
        `DELETE FROM employees WHERE org_id = ${q(orgId)};`,
        `DELETE FROM sessions WHERE user_id = ${q(`demo-user-${n}`)};`,
      )
    }
    sql.push(
      `INSERT OR IGNORE INTO organizations (id, name, kind, created_at) VALUES (${q(orgId)}, ${q(`Demo Company ${n}`)}, 'demo', ${now});`,
      `INSERT INTO users (id, org_id, username, password_hash, role, is_active, created_at)
       VALUES (${q(`demo-user-${n}`)}, ${q(orgId)}, ${q(cred.username)}, ${q(cred.hash)}, 'admin', 1, ${now})
       ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, is_active = 1;`,
    )
    const people = employeesFor(n)
    sql.push(
      ...insertBatches(
        'employees',
        'id, org_id, full_name, position, is_active, created_at',
        people.map((p) => `(${q(p.id)}, ${q(orgId)}, ${q(p.fullName)}, ${q(p.position)}, 1, ${now})`),
      ),
    )
    const entries = people.flatMap((p, i) => entriesFor(n, p.id, i + 1, now))
    sql.push(
      ...insertBatches(
        'time_entries',
        'id, org_id, employee_id, description, started_at, stopped_at, created_at, end_reason',
        entries.map(
          (e) => `(${q(e.id)}, ${q(orgId)}, ${q(e.employeeId)}, ${q(e.description)}, ${e.startedAt}, ${e.stoppedAt}, ${e.startedAt}, 'stopped')`,
        ),
      ),
    )
  }
  return sql.join('\n') + '\n'
}

function writeCredentialsMarkdown(store: CredentialStore) {
  const lines = [
    '# Demo account credentials',
    '',
    'PRIVATE. This file is git-ignored. Hand out one account per evaluator through a private channel.',
    '',
    '| # | Account | Password |',
    '|---|---|---|',
    ...Object.entries(store)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([n, c]) => `| ${n} | ${c.username} | ${c.password} |`),
    '',
  ]
  writeFileSync(CREDENTIALS_MD, lines.join('\n'))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  mkdirSync(SECRETS, { recursive: true })

  const store = loadCredentials()
  const only = args.reset ?? args.rotate
  const numbers = only ? [only] : Array.from({ length: ACCOUNTS }, (_, i) => i + 1)

  for (const n of numbers) {
    const key = String(n)
    if (!store[key] || args.rotate === n) {
      const password = generatePassword()
      store[key] = { username: `test-account_${n}`, password, hash: await hashPassword(password) }
      if (args.rotate === n) console.log(`New password issued for test-account_${n}`)
    }
  }
  writeFileSync(CREDENTIALS_JSON, JSON.stringify(store, null, 2))
  writeCredentialsMarkdown(store)

  writeFileSync(SQL_FILE, buildSql(numbers, store, args.reset, Date.now()))
  console.log(`Wrote ${SQL_FILE} for workspace(s): ${numbers.join(', ')}`)
  console.log(`Credentials: ${CREDENTIALS_MD} (private, git-ignored)`)
  if (args.printOnly) return

  const target = args.remote ? '--remote' : '--local'
  console.log(`Running against the ${args.remote ? 'REMOTE (production)' : 'local'} database...`)
  // Run Wrangler through Node directly: no shell, so no argument-escaping concerns.
  const wrangler = resolve(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  const run = spawnSync(process.execPath, [wrangler, 'd1', 'execute', 'DB', target, '--file', SQL_FILE], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (run.status !== 0) process.exit(run.status ?? 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
