import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PASSWORD, call, createOrg, createSession, createUser, login } from './helpers'

afterEach(() => vi.useRealTimers())

const attempt = (username: string, password: string) =>
  call('/api/auth/login', { method: 'POST', body: { username, password } })

describe('authentication', () => {
  it('TC-AUT-01 a valid login sets the session cookie and returns the account', async () => {
    const orgId = await createOrg('demo')
    await createUser(orgId, 'test-account_1')
    const res = await attempt('test-account_1', PASSWORD)
    expect(res.status).toBe(200)
    expect(res.json.user).toMatchObject({ username: 'test-account_1', role: 'admin' })
    expect(res.json.organization).toMatchObject({ id: orgId, kind: 'demo' })
    expect(typeof res.json.serverNow).toBe('number')
    expect(res.headers.get('Set-Cookie')).toContain('__Host-session=')
    expect(res.json).not.toHaveProperty('passwordHash')
  })

  it('TC-AUT-02 a wrong password and an unknown user get the same response', async () => {
    const orgId = await createOrg()
    await createUser(orgId, 'known-user')
    const wrong = await attempt('known-user', 'wrong-password-1')
    const unknown = await attempt('nobody-here', 'wrong-password-1')
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.json).toEqual(unknown.json)
    expect(wrong.json.error.message).toBe('Invalid account or password')
    expect(wrong.headers.get('Set-Cookie')).toBeNull()
  })

  it('TC-AUT-03 rate limits after 5 failed attempts, even for the right password', async () => {
    const orgId = await createOrg()
    await createUser(orgId, 'limited-user')
    for (let i = 0; i < 5; i++) expect((await attempt('limited-user', 'bad-password-1')).status).toBe(401)
    const blocked = await attempt('limited-user', PASSWORD)
    expect(blocked.status).toBe(429)
    expect(blocked.json.error.code).toBe('RATE_LIMITED')
  })

  it('rate limits one IP after 20 failures across different accounts', async () => {
    const orgId = await createOrg()
    await createUser(orgId, 'ip-user')
    for (let i = 0; i < 20; i++) expect((await attempt(`nobody-${i}`, 'bad-password-1')).status).toBe(401)
    expect((await attempt('ip-user', PASSWORD)).status).toBe(429)
    // A different IP is not affected.
    const other = await call('/api/auth/login', { method: 'POST', body: { username: 'ip-user', password: PASSWORD }, ip: '192.0.2.99' })
    expect(other.status).toBe(200)
  })

  it('rate limit window expires after 15 minutes', async () => {
    const orgId = await createOrg()
    await createUser(orgId, 'window-user')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 5, 1, 9, 0, 0))
    for (let i = 0; i < 5; i++) await attempt('window-user', 'bad-password-1')
    expect((await attempt('window-user', PASSWORD)).status).toBe(429)
    vi.setSystemTime(Date.UTC(2026, 5, 1, 9, 16, 0))
    expect((await attempt('window-user', PASSWORD)).status).toBe(200)
  })

  it('TC-AUT-04 protected endpoints return 401 without a session', async () => {
    const checks = [
      call('/api/auth/me'),
      call('/api/employees'),
      call('/api/employees', { method: 'POST', body: { fullName: 'X' } }),
      call('/api/timers'),
      call('/api/reports/summary?from=946684800000&to=946771200000'),
      call(`/api/employees/${crypto.randomUUID()}/timer/start`, { method: 'POST', body: { description: 'x' } }),
    ]
    for (const res of await Promise.all(checks)) {
      expect(res.status).toBe(401)
      expect(res.json.error.code).toBe('UNAUTHENTICATED')
    }
  })

  it('TC-AUT-05 logout invalidates the session', async () => {
    const { cookie } = await createSession()
    expect((await call('/api/auth/me', { cookie })).status).toBe(200)
    const out = await call('/api/auth/logout', { method: 'POST', cookie })
    expect(out.status).toBe(200)
    expect((await call('/api/auth/me', { cookie })).status).toBe(401)
  })

  it('TC-AUT-06 an expired session is rejected', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 5, 1))
    const { cookie } = await createSession()
    vi.setSystemTime(Date.UTC(2026, 5, 7, 23))
    expect((await call('/api/auth/me', { cookie })).status).toBe(200)
    vi.setSystemTime(Date.UTC(2026, 5, 8, 1))
    expect((await call('/api/auth/me', { cookie })).status).toBe(401)
  })

  it('TC-AUT-07 the cookie is host-only, secure, HttpOnly and SameSite=Lax', async () => {
    const orgId = await createOrg()
    await createUser(orgId, 'cookie-user')
    const res = await attempt('cookie-user', PASSWORD)
    const cookie = res.headers.get('Set-Cookie') ?? ''
    expect(cookie.startsWith('__Host-session=')).toBe(true)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=604800')
    expect(cookie.toLowerCase()).not.toContain('domain=')
  })

  it('stores only a hash of the session token', async () => {
    const { cookie } = await createSession()
    const token = cookie.split('=')[1]!
    const rows = await env.DB.prepare('SELECT token_hash FROM sessions').all<{ token_hash: string }>()
    expect(rows.results.length).toBeGreaterThan(0)
    expect(rows.results.some((r) => r.token_hash === token)).toBe(false)
  })

  it('rejects a deactivated account', async () => {
    const orgId = await createOrg()
    const id = await createUser(orgId, 'disabled-user')
    await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(id).run()
    expect((await attempt('disabled-user', PASSWORD)).status).toBe(401)
  })

  it('rejects a forged session cookie', async () => {
    const res = await call('/api/auth/me', { cookie: '__Host-session=not-a-real-token' })
    expect(res.status).toBe(401)
  })

  it('a session from before the login still works after another login (no cross-effects)', async () => {
    const orgId = await createOrg()
    await createUser(orgId, 'two-logins')
    const a = await login('two-logins')
    const b = await login('two-logins')
    expect((await call('/api/auth/me', { cookie: a })).status).toBe(200)
    expect((await call('/api/auth/me', { cookie: b })).status).toBe(200)
  })
})
