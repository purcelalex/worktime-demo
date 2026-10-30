import { env, exports } from 'cloudflare:workers'
import { hashPassword } from '../../src/worker/lib/password'

const ORIGIN = 'https://worktime.test'

export const PASSWORD = 'correct-horse-12!'
export const HOUR = 60 * 60 * 1000
export const MINUTE = 60 * 1000

let currentIp = '203.0.113.1'

/** Each test gets its own client IP so rate-limit counters do not leak between tests. */
export function newClientIp(): string {
  const n = () => Math.floor(Math.random() * 254) + 1
  currentIp = `198.51.${n()}.${n()}`
  return currentIp
}

interface Options {
  /** Client IP seen by the Worker (default: the current test's IP). */
  ip?: string
  method?: string
  body?: unknown
  cookie?: string
  headers?: Record<string, string>
  /** `null` sends no Origin header; a string sends that value (default: same origin). */
  origin?: string | null
  /** `null` sends no Content-Type (default: application/json). */
  contentType?: string | null
}

/** Calls the Worker the same way the browser does. */
export async function call(path: string, opts: Options = {}) {
  const method = opts.method ?? 'GET'
  const headers: Record<string, string> = { 'CF-Connecting-IP': opts.ip ?? currentIp, ...opts.headers }
  if (opts.cookie) headers.Cookie = opts.cookie
  if (method !== 'GET') {
    const origin = opts.origin === undefined ? ORIGIN : opts.origin
    if (origin) headers.Origin = origin
    const type = opts.contentType === undefined ? 'application/json' : opts.contentType
    if (type) headers['Content-Type'] = type
  }
  const res = await exports.default.fetch(
    new Request(ORIGIN + path, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(opts.body ?? {}),
    }),
  )
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, headers: res.headers, json }
}

let counter = 0

export async function createOrg(kind: 'demo' | 'real' = 'demo') {
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO organizations (id, name, kind, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, `Org ${++counter}`, kind, Date.now())
    .run()
  return id
}

export async function createUser(orgId: string, username: string, password = PASSWORD) {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO users (id, org_id, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
  )
    .bind(id, orgId, username, await hashPassword(password), 'admin', Date.now())
    .run()
  return id
}

/** Logs in and returns the session cookie ("__Host-session=..."). */
export async function login(username: string, password = PASSWORD): Promise<string> {
  const res = await call('/api/auth/login', { method: 'POST', body: { username, password } })
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`)
  const setCookie = res.headers.get('Set-Cookie') ?? ''
  return setCookie.split(';')[0]!
}

/** A fresh organization with one signed-in admin. */
export async function createSession(kind: 'demo' | 'real' = 'demo') {
  const orgId = await createOrg(kind)
  const username = `user-${crypto.randomUUID().slice(0, 8)}`
  await createUser(orgId, username)
  const cookie = await login(username)
  return { orgId, username, cookie }
}

export async function addEmployee(cookie: string, fullName: string, position?: string) {
  const res = await call('/api/employees', { method: 'POST', cookie, body: { fullName, position } })
  if (res.status !== 201) throw new Error(`addEmployee failed: ${res.status} ${JSON.stringify(res.json)}`)
  return res.json.employee as { id: string; fullName: string }
}

/** Inserts an entry directly, for report tests that need exact timestamps. */
export async function insertEntry(
  orgId: string,
  employeeId: string,
  startedAt: number,
  stoppedAt: number | null,
  description = 'Task',
) {
  await env.DB.prepare(
    'INSERT INTO time_entries (id, org_id, employee_id, description, started_at, stopped_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), orgId, employeeId, description, startedAt, stoppedAt, startedAt)
    .run()
}
