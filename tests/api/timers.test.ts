import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOUR, MINUTE, addEmployee, call, createSession } from './helpers'

const T0 = Date.UTC(2026, 5, 1, 9, 0, 0)

function at(time: number) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(time)
}

afterEach(() => vi.useRealTimers())

const start = (cookie: string, id: string, description = 'Write docs') =>
  call(`/api/employees/${id}/timer/start`, { method: 'POST', cookie, body: { description } })
const stop = (cookie: string, id: string) => call(`/api/employees/${id}/timer/stop`, { method: 'POST', cookie })

describe('timers', () => {
  it('TC-TMR-01 start then stop gives the correct duration', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    at(T0)
    const started = await start(cookie, e.id)
    expect(started.status).toBe(201)
    expect(started.json.timer.startedAt).toBe(T0)
    at(T0 + 90 * MINUTE)
    const stopped = await stop(cookie, e.id)
    expect(stopped.status).toBe(200)
    expect(stopped.json.entry.durationMs).toBe(90 * MINUTE)
    expect((await call('/api/timers', { cookie })).json.timers).toHaveLength(0)
  })

  it('TC-TMR-02 requires a task description', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    for (const description of ['', '   ']) {
      expect((await start(cookie, e.id, description)).status).toBe(400)
    }
    expect((await start(cookie, e.id, 'x'.repeat(201))).status).toBe(400)
    expect((await start(cookie, e.id, 'x'.repeat(200))).status).toBe(201)
  })

  it('TC-TMR-03 starting while running returns 409', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await start(cookie, e.id)
    const again = await start(cookie, e.id, 'Another task')
    expect(again.status).toBe(409)
    expect(again.json.error.message).toBe('This employee already has a running timer')
  })

  it('TC-TMR-04 stopping while idle returns 409', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    const res = await stop(cookie, e.id)
    expect(res.status).toBe(409)
    expect(res.json.error.message).toBe('No running timer for this employee')
  })

  it('TC-TMR-05 restart: stop then start creates a second independent entry', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    at(T0)
    const first = await start(cookie, e.id, 'First task')
    at(T0 + HOUR)
    await stop(cookie, e.id)
    at(T0 + 2 * HOUR)
    const second = await start(cookie, e.id, 'Second task')
    expect(second.status).toBe(201)
    expect(second.json.timer.id).not.toBe(first.json.timer.id)
    at(T0 + 2 * HOUR + 30 * MINUTE)
    await stop(cookie, e.id)

    const report = await call(`/api/reports/summary?from=${T0 - HOUR}&to=${T0 + 5 * HOUR}`, { cookie })
    const row = report.json.employees[0]
    expect(row.entryCount).toBe(2)
    expect(row.totalMs).toBe(HOUR + 30 * MINUTE)
  })

  it('TC-TMR-06 two employees can run timers at the same time', async () => {
    const { cookie } = await createSession()
    const a = await addEmployee(cookie, 'Alex Morgan')
    const b = await addEmployee(cookie, 'Sam Rivera')
    expect((await start(cookie, a.id, 'A task')).status).toBe(201)
    expect((await start(cookie, b.id, 'B task')).status).toBe(201)
    expect((await call('/api/timers', { cookie })).json.timers).toHaveLength(2)
  })

  it('TC-TMR-07 concurrent starts leave exactly one running entry', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    const results = await Promise.all([start(cookie, e.id, 'One'), start(cookie, e.id, 'Two'), start(cookie, e.id, 'Three')])
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(2)
    expect((await call('/api/timers', { cookie })).json.timers).toHaveLength(1)
  })

  it('TC-TMR-08 an unknown employee gives 404', async () => {
    const { cookie } = await createSession()
    const id = crypto.randomUUID()
    expect((await start(cookie, id)).status).toBe(404)
    expect((await stop(cookie, id)).status).toBe(404)
  })
})
