import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDb } from '../../src/worker/db/client'
import { listEmployees, listActiveTimers } from '../../src/worker/db/repo'
import { HOUR, addEmployee, call, createSession } from './helpers'

afterEach(() => vi.useRealTimers())

describe('persistence', () => {
  it('TC-PER-01 data written through the API is read back by a fresh data client', async () => {
    const { cookie, orgId } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan', 'Developer')
    // A brand-new client on the same database, with no shared in-memory state.
    const fresh = createDb(env.DB)
    const people = await listEmployees(fresh, orgId)
    expect(people).toHaveLength(1)
    expect(people[0]).toMatchObject({ id: e.id, fullName: 'Alex Morgan', position: 'Developer' })
  })

  it('TC-PER-02 a running timer survives and its elapsed time continues', async () => {
    const T0 = Date.UTC(2026, 5, 1, 9, 0, 0)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(T0)
    const { cookie, orgId } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await call(`/api/employees/${e.id}/timer/start`, { method: 'POST', cookie, body: { description: 'Long task' } })

    // "Restart": a new data client, three hours later.
    vi.setSystemTime(T0 + 3 * HOUR)
    const running = await listActiveTimers(createDb(env.DB), orgId)
    expect(running).toHaveLength(1)
    expect(running[0]).toMatchObject({ employeeId: e.id, description: 'Long task', startedAt: T0, state: 'running' })

    const report = await call(`/api/reports/summary?from=${T0 - HOUR}&to=${T0 + 6 * HOUR}`, { cookie })
    expect(report.json.employees[0].totalMs).toBe(3 * HOUR)
    expect(report.json.serverNow).toBe(T0 + 3 * HOUR)
  })
})
