import { describe, expect, it } from 'vitest'
import { addEmployee, call, createSession } from './helpers'

describe('tenant isolation', () => {
  it('TC-ISO-01 organization A cannot read, start, stop or report on B\'s employees', async () => {
    const a = await createSession()
    const b = await createSession()
    const bob = await addEmployee(b.cookie, 'Bob From B')
    await call(`/api/employees/${bob.id}/timer/start`, { method: 'POST', cookie: b.cookie, body: { description: 'Secret work' } })

    // A does not see B's employee or timer.
    expect((await call('/api/employees', { cookie: a.cookie })).json.employees).toEqual([])
    expect((await call('/api/timers', { cookie: a.cookie })).json.timers).toEqual([])

    // A cannot act on B's employee: it behaves exactly like a non-existent id.
    const start = await call(`/api/employees/${bob.id}/timer/start`, { method: 'POST', cookie: a.cookie, body: { description: 'x' } })
    const stop = await call(`/api/employees/${bob.id}/timer/stop`, { method: 'POST', cookie: a.cookie })
    const ghost = await call(`/api/employees/${crypto.randomUUID()}/timer/stop`, { method: 'POST', cookie: a.cookie })
    expect(start.status).toBe(404)
    expect(stop.status).toBe(404)
    expect(stop.json).toEqual(ghost.json)

    // B's timer is untouched.
    expect((await call('/api/timers', { cookie: b.cookie })).json.timers).toHaveLength(1)

    // A's report never mentions B's data.
    const report = await call(`/api/reports/summary?from=946684800000&to=4102444800000`, { cookie: a.cookie })
    expect(JSON.stringify(report.json)).not.toContain('Bob From B')
    expect(JSON.stringify(report.json)).not.toContain('Secret work')
  })

  it('TC-ISO-02 the session decides the organization, never the request', async () => {
    const a = await createSession()
    const b = await createSession()
    const spoof = await call('/api/employees', {
      method: 'POST',
      cookie: a.cookie,
      body: { fullName: 'Spoof', orgId: b.orgId },
    })
    expect(spoof.status).toBe(400) // unknown field rejected
    const viaQuery = await call(`/api/employees?orgId=${b.orgId}`, { cookie: a.cookie })
    expect(viaQuery.json.employees).toEqual([])
  })

  it('the same employee name can exist in two organizations', async () => {
    const a = await createSession()
    const b = await createSession()
    await addEmployee(a.cookie, 'Alex Morgan')
    await addEmployee(b.cookie, 'Alex Morgan')
  })
})
