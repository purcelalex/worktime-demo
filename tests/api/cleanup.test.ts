import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { purgeExpired } from '../../src/worker/cleanup'
import { HOUR, call, createOrg, createUser, login } from './helpers'

describe('retention cleanup', () => {
  it('TC-GDPR-01 deletes expired sessions and old throttling rows, keeps the rest', async () => {
    const orgId = await createOrg()
    const userId = await createUser(orgId, 'cleanup-user')
    const liveCookie = await login('cleanup-user')
    const now = Date.now()

    await env.DB.batch([
      env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind('expired-1', userId, now - HOUR, now - 8 * 24 * HOUR),
      env.DB.prepare('INSERT INTO login_attempts (key, count, window_start) VALUES (?, ?, ?)').bind('ip:old-address', 3, now - 25 * HOUR),
      env.DB.prepare('INSERT INTO login_attempts (key, count, window_start) VALUES (?, ?, ?)').bind('ip:recent-address', 2, now - 10 * 60 * 1000),
    ])

    const result = await purgeExpired(env.DB, now)
    expect(result.sessions).toBe(1)
    expect(result.loginAttempts).toBe(1)

    const attempts = await env.DB.prepare('SELECT key FROM login_attempts').all<{ key: string }>()
    const keys = attempts.results.map((r) => r.key)
    expect(keys).toContain('ip:recent-address')
    expect(keys).not.toContain('ip:old-address')

    // A live session is untouched.
    expect((await call('/api/auth/me', { cookie: liveCookie })).status).toBe(200)
  })

  it('is safe to run on an empty database', async () => {
    const result = await purgeExpired(env.DB, Date.now())
    expect(result.sessions).toBeGreaterThanOrEqual(0)
  })
})
