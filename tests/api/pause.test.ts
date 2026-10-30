import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOUR, MINUTE, addEmployee, call, createSession } from './helpers'

const T0 = Date.UTC(2026, 5, 1, 9, 0, 0)

function at(time: number) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(time)
}

afterEach(() => vi.useRealTimers())

const post = (cookie: string, id: string, action: 'start' | 'pause' | 'resume' | 'stop', description = 'Write docs') =>
  call(`/api/employees/${id}/timer/${action}`, {
    method: 'POST',
    cookie,
    body: action === 'start' ? { description } : {},
  })

const timers = async (cookie: string) => (await call('/api/timers', { cookie })).json.timers as any[]

describe('pause and resume', () => {
  it('TC-TMR-09 pausing keeps the task and stops counting', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    at(T0)
    await post(cookie, e.id, 'start')
    at(T0 + 30 * MINUTE)
    const paused = await post(cookie, e.id, 'pause')
    expect(paused.status).toBe(200)
    expect(paused.json.timer).toMatchObject({ state: 'paused', description: 'Write docs', startedAt: T0, pausedAt: T0 + 30 * MINUTE, carriedMs: 0 })

    // Hours later it is still paused and the numbers have not moved.
    at(T0 + 5 * HOUR)
    const list = await timers(cookie)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ state: 'paused', pausedAt: T0 + 30 * MINUTE })
  })

  it('TC-TMR-10 resume continues the same task from the time already worked', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    at(T0)
    await post(cookie, e.id, 'start')
    at(T0 + 30 * MINUTE)
    await post(cookie, e.id, 'pause')
    at(T0 + 2 * HOUR)
    const resumed = await post(cookie, e.id, 'resume')
    expect(resumed.status).toBe(200)
    expect(resumed.json.timer).toMatchObject({
      state: 'running',
      description: 'Write docs',
      startedAt: T0 + 2 * HOUR,
      pausedAt: null,
      carriedMs: 30 * MINUTE, // the 90 minutes of pause are not counted
    })
    at(T0 + 2 * HOUR + 15 * MINUTE)
    const stopped = await post(cookie, e.id, 'stop')
    expect(stopped.json.entry).toMatchObject({ durationMs: 15 * MINUTE, totalMs: 45 * MINUTE })
  })

  it('TC-TMR-11 the time spent paused never reaches the report', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    at(T0)
    await post(cookie, e.id, 'start')
    at(T0 + HOUR)
    await post(cookie, e.id, 'pause')
    at(T0 + 3 * HOUR)
    await post(cookie, e.id, 'resume')
    at(T0 + 3 * HOUR + 30 * MINUTE)
    await post(cookie, e.id, 'stop')

    const report = await call(`/api/reports/summary?from=${T0 - HOUR}&to=${T0 + 8 * HOUR}`, { cookie })
    const row = report.json.employees[0]
    expect(row.totalMs).toBe(HOUR + 30 * MINUTE) // 1h + 30m worked, the 2h pause is excluded
    expect(row.entryCount).toBe(2) // two work segments
  })

  it('carries the total across several pauses', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    at(T0)
    await post(cookie, e.id, 'start')
    at(T0 + 10 * MINUTE)
    await post(cookie, e.id, 'pause')
    at(T0 + HOUR)
    await post(cookie, e.id, 'resume')
    at(T0 + HOUR + 20 * MINUTE)
    await post(cookie, e.id, 'pause')
    at(T0 + 2 * HOUR)
    const resumed = await post(cookie, e.id, 'resume')
    expect(resumed.json.timer.carriedMs).toBe(30 * MINUTE)
    at(T0 + 2 * HOUR + 5 * MINUTE)
    const stopped = await post(cookie, e.id, 'stop')
    expect(stopped.json.entry.totalMs).toBe(35 * MINUTE)
  })

  it('TC-TMR-12 pausing when nothing is running returns 409', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    const res = await post(cookie, e.id, 'pause')
    expect(res.status).toBe(409)
    expect(res.json.error.message).toBe('No running timer for this employee')
  })

  it('pausing twice returns 409', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await post(cookie, e.id, 'start')
    expect((await post(cookie, e.id, 'pause')).status).toBe(200)
    expect((await post(cookie, e.id, 'pause')).status).toBe(409)
  })

  it('TC-TMR-13 resuming when nothing is paused returns 409', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    expect((await post(cookie, e.id, 'resume')).status).toBe(409) // idle
    await post(cookie, e.id, 'start')
    const running = await post(cookie, e.id, 'resume') // running, not paused
    expect(running.status).toBe(409)
    expect(running.json.error.message).toBe('No paused timer for this employee')
  })

  it('TC-TMR-14 starting a new task while paused returns 409', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await post(cookie, e.id, 'start')
    await post(cookie, e.id, 'pause')
    const res = await post(cookie, e.id, 'start', 'Another task')
    expect(res.status).toBe(409)
    expect(res.json.error.message).toContain('paused timer')
  })

  it('TC-TMR-15 stopping a paused timer ends the task without adding time', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    at(T0)
    await post(cookie, e.id, 'start')
    at(T0 + 20 * MINUTE)
    await post(cookie, e.id, 'pause')
    at(T0 + 4 * HOUR)
    const stopped = await post(cookie, e.id, 'stop')
    expect(stopped.status).toBe(200)
    expect(stopped.json.entry).toMatchObject({ durationMs: 20 * MINUTE, totalMs: 20 * MINUTE })
    expect(await timers(cookie)).toHaveLength(0)

    // The employee can now start a fresh task, and resume has nothing to resume.
    expect((await post(cookie, e.id, 'resume')).status).toBe(409)
    expect((await post(cookie, e.id, 'start', 'Next task')).status).toBe(201)
  })

  it('TC-TMR-16 concurrent resumes create exactly one running segment', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await post(cookie, e.id, 'start')
    await post(cookie, e.id, 'pause')
    const results = await Promise.all([post(cookie, e.id, 'resume'), post(cookie, e.id, 'resume'), post(cookie, e.id, 'resume')])
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(2)
    const list = await timers(cookie)
    expect(list).toHaveLength(1)
    expect(list[0].state).toBe('running')
  })

  it('TC-TMR-17 a paused employee and a running employee are listed together', async () => {
    const { cookie } = await createSession()
    const a = await addEmployee(cookie, 'Alex Morgan')
    const b = await addEmployee(cookie, 'Sam Rivera')
    await post(cookie, a.id, 'start', 'A task')
    await post(cookie, a.id, 'pause')
    await post(cookie, b.id, 'start', 'B task')
    const list = await timers(cookie)
    expect(list.map((t) => `${t.employeeId === a.id ? 'A' : 'B'}:${t.state}`).sort()).toEqual(['A:paused', 'B:running'])
  })

  it('TC-ISO-03 another organization cannot pause or resume this timer (404)', async () => {
    const a = await createSession()
    const b = await createSession()
    const e = await addEmployee(a.cookie, 'Alex Morgan')
    await post(a.cookie, e.id, 'start')
    expect((await post(b.cookie, e.id, 'pause')).status).toBe(404)
    await post(a.cookie, e.id, 'pause')
    expect((await post(b.cookie, e.id, 'resume')).status).toBe(404)
    expect((await timers(a.cookie))[0].state).toBe('paused')
  })

  it('a paused timer survives and still resumes later (persistence)', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    at(T0)
    await post(cookie, e.id, 'start')
    at(T0 + HOUR)
    await post(cookie, e.id, 'pause')
    at(T0 + 3 * 24 * HOUR)
    const resumed = await post(cookie, e.id, 'resume')
    expect(resumed.status).toBe(200)
    expect(resumed.json.timer.carriedMs).toBe(HOUR)
  })

  it('requires an authenticated, same-origin JSON request', async () => {
    const { cookie } = await createSession()
    const e = await addEmployee(cookie, 'Alex Morgan')
    await post(cookie, e.id, 'start')
    expect((await call(`/api/employees/${e.id}/timer/pause`, { method: 'POST' })).status).toBe(401)
    expect((await call(`/api/employees/${e.id}/timer/pause`, { method: 'POST', cookie, origin: 'https://evil.example' })).status).toBe(400)
    expect((await timers(cookie))[0].state).toBe('running')
  })
})
