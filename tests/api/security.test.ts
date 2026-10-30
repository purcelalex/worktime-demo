import { describe, expect, it } from 'vitest'
import { call, createSession } from './helpers'

describe('security', () => {
  it('TC-SEC-01 sets security headers on success and error API responses', async () => {
    const { cookie } = await createSession()
    const ok = await call('/api/employees', { cookie })
    const denied = await call('/api/employees')
    const missing = await call('/api/does-not-exist', { cookie })
    for (const res of [ok, denied, missing]) {
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=')
      expect(res.headers.get('Permissions-Policy')).toContain('camera=()')
      expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
      expect(res.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(missing.status).toBe(404)
  })

  it('TC-SEC-02 the API CSP allows nothing and has no unsafe directives', async () => {
    const res = await call('/api/employees')
    const csp = res.headers.get('Content-Security-Policy') ?? ''
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).not.toContain('unsafe-eval')
  })

  it('TC-SEC-03 rejects state-changing requests with a foreign or missing Origin', async () => {
    const { cookie } = await createSession()
    const body = { fullName: 'Intruder' }
    expect((await call('/api/employees', { method: 'POST', cookie, body, origin: 'https://evil.example' })).status).toBe(400)
    expect((await call('/api/employees', { method: 'POST', cookie, body, origin: null })).status).toBe(400)
    expect((await call('/api/employees', { method: 'POST', cookie, body, contentType: 'text/plain' })).status).toBe(400)
    expect((await call('/api/employees', { method: 'POST', cookie, body, contentType: null })).status).toBe(400)
    expect((await call('/api/employees', { cookie })).json.employees).toEqual([])
  })

  it('rejects malformed JSON without leaking details', async () => {
    const res = await call('/api/auth/login', { method: 'POST', body: undefined })
    expect(res.status).toBe(400) // {} fails the login schema, not a crash
    expect(JSON.stringify(res.json)).not.toMatch(/stack|at .*\(/i)
  })

  it('does not reveal internals in error bodies', async () => {
    const res = await call('/api/auth/login', { method: 'POST', body: { username: 'x', password: 'y', extra: 1 } })
    expect(res.status).toBe(400)
    expect(Object.keys(res.json)).toEqual(['error'])
  })
})
