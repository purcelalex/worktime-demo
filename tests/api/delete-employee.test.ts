import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOUR, MINUTE, addEmployee, call, createSession, insertEntry } from './helpers'

const D1 = Date.UTC(2026, 5, 1)
const D2 = D1 + 24 * HOUR - 1

afterEach(() => vi.useRealTimers())

const remove = (cookie: string, id: string) => call(`/api/employees/${id}`, { method: 'DELETE', cookie })
const names = async (cookie: string) =>
  ((await call('/api/employees', { cookie })).json.employees as { fullName: string }[]).map((e) => e.fullName)
const report = (cookie: string) => call(`/api/reports/summary?from=${D1}&to=${D2}`, { cookie })

describe('deleting an employee', () => {
  it('TC-EMP-08 removes the employee from the list', async () => {
    const { cookie } = await createSession()
    const keep = await addEmployee(cookie, 'Keep Me')
    const gone = await addEmployee(cookie, 'Delete Me')
    const res = await remove(cookie, gone.id)
    expect(res.status).toBe(200)
    expect(res.json.ok).toBe(true)
    expect(await names(cookie)).toEqual(['Keep Me'])
    expect(keep.id).toBeTruthy()
  })

  it('TC-EMP-09 keeps the history: records stay in the report, marked as deleted', async () => {
    const { cookie, orgId } = await createSession()
    const e = await addEmployee(cookie, 'Former Employee')
    const other = await addEmployee(cookie, 'Current Employee')
    await insertEntry(orgId, e.id, D1 + 9 * HOUR, D1 + 11 * HOUR, 'Old project work')
    await insertEntry(orgId, other.id, D1 + 9 * HOUR, D1 + 10 * HOUR)

    const before = (await report(cookie)).json
    await remove(cookie, e.id)
    const after = (await report(cookie)).json

    const row = after.employees.find((x: { id: string }) => x.id === e.id)
    expect(row).toMatchObject({ fullName: 'Former Employee', deleted: true, totalMs: 2 * HOUR, entryCount: 1 })
    expect(row.entries[0].description).toBe('Old project work')
    expect(after.totalMs).toBe(before.totalMs) // history is unchanged by the deletion
    expect(after.employees.find((x: { id: string }) => x.id === other.id).deleted).toBe(false)
  })

  it('TC-EMP-10 a deleted employee with no records in the period is not listed in the report', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Quiet Former')
    await remove(cookie, e.id)
    const res = await report(cookie)
    expect(res.json.employees).toEqual([])
  })

  it('TC-EMP-11 refuses while a timer is running or paused (409), allows after stopping', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Busy Person')
    await call(`/api/employees/${e.id}/timer/start`, { method: 'POST', cookie, body: { description: 'Working' } })

    const running = await remove(cookie, e.id)
    expect(running.status).toBe(409)
    expect(running.json.error.message).toBe("Stop this employee's timer before deleting them")

    await call(`/api/employees/${e.id}/timer/pause`, { method: 'POST', cookie })
    expect((await remove(cookie, e.id)).status).toBe(409) // paused still counts as open

    await call(`/api/employees/${e.id}/timer/stop`, { method: 'POST', cookie })
    expect((await remove(cookie, e.id)).status).toBe(200)
    expect(await names(cookie)).toEqual([])
  })

  it('TC-EMP-12 deleting twice or an unknown id gives 404', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Once Only')
    expect((await remove(cookie, e.id)).status).toBe(200)
    expect((await remove(cookie, e.id)).status).toBe(404)
    expect((await remove(cookie, crypto.randomUUID())).status).toBe(404)
  })

  it('TC-EMP-13 the name can be reused after deletion', async () => {
    const { cookie } = await createSession()
    const first = await addEmployee(cookie, 'Same Name')
    await remove(cookie, first.id)
    const second = await addEmployee(cookie, 'Same Name')
    expect(second.id).not.toBe(first.id)
    // But two active employees still cannot share a name.
    const dup = await call('/api/employees', { method: 'POST', cookie, body: { fullName: 'same name' } })
    expect(dup.status).toBe(409)
  })

  it('TC-EMP-14 a deleted employee can no longer start a timer', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Gone Soon')
    await remove(cookie, e.id)
    const res = await call(`/api/employees/${e.id}/timer/start`, { method: 'POST', cookie, body: { description: 'x' } })
    expect(res.status).toBe(404)
  })

  it('TC-ISO-04 another organization cannot delete this employee (404)', async () => {
    const a = await createSession()
    const b = await createSession()
    const e = await addEmployee(a.cookie, 'Protected Person')
    expect((await remove(b.cookie, e.id)).status).toBe(404)
    expect(await names(a.cookie)).toEqual(['Protected Person'])
  })

  it('requires a session and a same-origin request', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Needs Auth')
    expect((await call(`/api/employees/${e.id}`, { method: 'DELETE' })).status).toBe(401)
    expect((await call(`/api/employees/${e.id}`, { method: 'DELETE', cookie, origin: 'https://evil.example' })).status).toBe(400)
    expect(await names(cookie)).toEqual(['Needs Auth'])
  })

  it('the row is kept in the database with a deletion time (soft delete)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(D1 + 5 * MINUTE)
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Kept In Database')
    await remove(cookie, e.id)
    const row = await env.DB.prepare('SELECT is_active, deleted_at FROM employees WHERE id = ?')
      .bind(e.id)
      .first<{ is_active: number; deleted_at: number }>()
    expect(row).toEqual({ is_active: 0, deleted_at: D1 + 5 * MINUTE })
  })
})
