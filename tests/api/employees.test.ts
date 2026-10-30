import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { call, createSession } from './helpers'

describe('employees', () => {
  it('TC-EMP-01 adds a valid employee', async () => {
    const { cookie } = await createSession()
    const res = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'Alex Morgan', position: 'Developer' } })
    expect(res.status).toBe(201)
    expect(res.json.employee).toMatchObject({ fullName: 'Alex Morgan', position: 'Developer' })
    const list = await call('/api/employees', { cookie })
    expect(list.json.employees).toHaveLength(1)
  })

  it('TC-EMP-02 rejects an empty name', async () => {
    const { cookie } = await createSession()
    for (const fullName of ['', '   ']) {
      const res = await call('/api/employees', { method: 'POST', cookie, body: { fullName } })
      expect(res.status).toBe(400)
      expect(res.json.error.code).toBe('VALIDATION_ERROR')
      expect(res.json.error.fields.fullName).toBeTruthy()
    }
  })

  it('TC-EMP-03 rejects a name over 100 characters', async () => {
    const { cookie } = await createSession()
    const ok = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'a'.repeat(100) } })
    expect(ok.status).toBe(201)
    const res = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'a'.repeat(101) } })
    expect(res.status).toBe(400)
  })

  it('TC-EMP-04 rejects a duplicate name, ignoring case and spaces', async () => {
    const { cookie } = await createSession()
    await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'Sam Rivera' } })
    const res = await call('/api/employees', { method: 'POST', cookie, body: { fullName: '  sam rivera ' } })
    expect(res.status).toBe(409)
    expect(res.json.error.code).toBe('CONFLICT')
  })

  it('TC-EMP-05 treats position as optional and trims it', async () => {
    const { cookie } = await createSession()
    const a = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'No Position' } })
    expect(a.json.employee.position).toBeNull()
    const b = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'Spaced', position: '  QA  ' } })
    expect(b.json.employee.position).toBe('QA')
    const c = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'Blank', position: '   ' } })
    expect(c.json.employee.position).toBeNull()
  })

  it('TC-EMP-06 caps a demo organization at 50 employees', async () => {
    const { cookie, orgId } = await createSession('demo')
    const stmt = env.DB.prepare(
      'INSERT INTO employees (id, org_id, full_name, is_active, created_at) VALUES (?, ?, ?, 1, ?)',
    )
    await env.DB.batch(
      Array.from({ length: 50 }, (_, i) => stmt.bind(crypto.randomUUID(), orgId, `Person ${i}`, Date.now())),
    )
    const res = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'One Too Many' } })
    expect(res.status).toBe(409)
    expect(res.json.error.message).toContain('limit')
  })

  it('TC-EMP-07 lists employees ordered by name', async () => {
    const { cookie } = await createSession()
    for (const fullName of ['Charlie', 'alice', 'Bob']) {
      await call('/api/employees', { method: 'POST', cookie, body: { fullName } })
    }
    const list = await call('/api/employees', { cookie })
    expect(list.json.employees.map((e: { fullName: string }) => e.fullName)).toEqual(['alice', 'Bob', 'Charlie'])
  })

  it('rejects unknown fields and control characters', async () => {
    const { cookie } = await createSession()
    const a = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'X', orgId: 'other' } })
    expect(a.status).toBe(400)
    const b = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'Bad\u0000Name' } })
    expect(b.status).toBe(400)
  })
})
