import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOUR, MINUTE, addEmployee, call, createSession, insertEntry } from './helpers'

const DAY = 24 * HOUR
const D1 = Date.UTC(2026, 5, 1) // start of the period used below
const D2 = D1 + DAY - 1 // end of that day

afterEach(() => vi.useRealTimers())

const report = (cookie: string, from: number, to: number) =>
  call(`/api/reports/summary?from=${from}&to=${to}`, { cookie })

describe('reports', () => {
  it('TC-REP-01 totals equal the sum of entries', async () => {
    const { cookie, orgId } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await insertEntry(orgId, e.id, D1 + 9 * HOUR, D1 + 10 * HOUR)
    await insertEntry(orgId, e.id, D1 + 11 * HOUR, D1 + 11 * HOUR + 30 * MINUTE)
    const res = await report(cookie, D1, D2)
    expect(res.status).toBe(200)
    expect(res.json.employees[0]).toMatchObject({ totalMs: 90 * MINUTE, entryCount: 2 })
    expect(res.json.totalMs).toBe(90 * MINUTE)
    expect(res.json.entryCount).toBe(2)
  })

  it('TC-REP-02 empty report: employees without entries show zero', async () => {
    const { cookie } = await createSession()
    await addEmployee(cookie, 'Alex Morgan')
    await addEmployee(cookie, 'Sam Rivera')
    const res = await report(cookie, D1, D2)
    expect(res.status).toBe(200)
    expect(res.json.totalMs).toBe(0)
    expect(res.json.entryCount).toBe(0)
    expect(res.json.employees).toHaveLength(2)
    for (const e of res.json.employees) expect(e).toMatchObject({ totalMs: 0, entryCount: 0, entries: [] })
  })

  it('TC-REP-03 an organization without employees returns an empty list', async () => {
    const { cookie } = await createSession()
    const res = await report(cookie, D1, D2)
    expect(res.status).toBe(200)
    expect(res.json.employees).toEqual([])
    expect(res.json.totalMs).toBe(0)
  })

  it('TC-REP-04 a period with no overlapping entries returns zeros', async () => {
    const { cookie, orgId } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await insertEntry(orgId, e.id, D1 - 3 * DAY, D1 - 3 * DAY + HOUR)
    const res = await report(cookie, D1, D2)
    expect(res.json.employees[0]).toMatchObject({ totalMs: 0, entryCount: 0 })
  })

  it('TC-REP-05 an entry crossing the period start is clipped', async () => {
    const { cookie, orgId } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await insertEntry(orgId, e.id, D1 - HOUR, D1 + 2 * HOUR)
    const res = await report(cookie, D1, D2)
    expect(res.json.employees[0]).toMatchObject({ totalMs: 2 * HOUR, entryCount: 1 })
  })

  it('TC-REP-06 an entry crossing the period end is clipped', async () => {
    const { cookie, orgId } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await insertEntry(orgId, e.id, D2 - HOUR, D2 + 3 * HOUR)
    const res = await report(cookie, D1, D2)
    expect(res.json.employees[0]).toMatchObject({ totalMs: HOUR, entryCount: 1 })
  })

  it('TC-REP-07 a running entry counts up to now', async () => {
    const { cookie, orgId } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await insertEntry(orgId, e.id, D1 + 9 * HOUR, null)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(D1 + 12 * HOUR)
    const res = await report(cookie, D1, D2)
    expect(res.json.employees[0].totalMs).toBe(3 * HOUR)
    expect(res.json.employees[0].entries[0]).toMatchObject({ running: true, stoppedAt: null })
  })

  it('TC-REP-08 rejects from after to', async () => {
    const { cookie } = await createSession()
    expect((await report(cookie, D2, D1)).status).toBe(400)
  })

  it('TC-REP-09 rejects a range over 366 days and bad parameters', async () => {
    const { cookie } = await createSession()
    expect((await report(cookie, D1, D1 + 367 * DAY)).status).toBe(400)
    expect((await report(cookie, D1, D1 + 366 * DAY)).status).toBe(200)
    expect((await call('/api/reports/summary?from=abc&to=1', { cookie })).status).toBe(400)
    expect((await call('/api/reports/summary', { cookie })).status).toBe(400)
  })

  it('TC-REP-10 entries of other organizations never appear', async () => {
    const a = await createSession()
    const b = await createSession()
    const ea = await addEmployee(a.cookie, 'Alex Morgan')
    await insertEntry(a.orgId, ea.id, D1 + HOUR, D1 + 2 * HOUR)
    const res = await report(b.cookie, D1, D2)
    expect(res.json.employees).toEqual([])
    expect(res.json.entryCount).toBe(0)
  })
})
