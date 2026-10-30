import { Hono } from 'hono'
import { createEmployeeSchema, startTimerSchema, emptyBodySchema } from '../../shared/schemas'
import { createEmployee, deleteEmployee, listEmployees, pauseTimer, resumeTimer, startTimer, stopTimer } from '../db/repo'
import type { AppEnv } from '../env'
import { parseBody } from '../lib/validate'
import { requireSession } from '../middleware/session'

export const employees = new Hono<AppEnv>()
employees.use('*', requireSession)

employees.get('/', async (c) => {
  const { orgId } = c.get('auth')
  return c.json({ employees: await listEmployees(c.get('db'), orgId) })
})

employees.post('/', async (c) => {
  const { orgId, orgKind } = c.get('auth')
  const input = await parseBody(c, createEmployeeSchema)
  const employee = await createEmployee(c.get('db'), orgId, orgKind, input, Date.now())
  return c.json({ employee }, 201)
})

employees.post('/:id/timer/start', async (c) => {
  const { orgId } = c.get('auth')
  const { description } = await parseBody(c, startTimerSchema)
  const now = Date.now()
  const timer = await startTimer(c.get('db'), orgId, c.req.param('id'), description, now)
  return c.json({ serverNow: now, timer }, 201)
})

employees.post('/:id/timer/stop', async (c) => {
  const { orgId } = c.get('auth')
  await parseBody(c, emptyBodySchema)
  const now = Date.now()
  const entry = await stopTimer(c.get('db'), orgId, c.req.param('id'), now)
  return c.json({ serverNow: now, entry })
})

employees.post('/:id/timer/pause', async (c) => {
  const { orgId } = c.get('auth')
  await parseBody(c, emptyBodySchema)
  const now = Date.now()
  const timer = await pauseTimer(c.get('db'), orgId, c.req.param('id'), now)
  return c.json({ serverNow: now, timer })
})

employees.post('/:id/timer/resume', async (c) => {
  const { orgId } = c.get('auth')
  await parseBody(c, emptyBodySchema)
  const now = Date.now()
  const timer = await resumeTimer(c.get('db'), orgId, c.req.param('id'), now)
  return c.json({ serverNow: now, timer })
})

employees.delete('/:id', async (c) => {
  const { orgId } = c.get('auth')
  await parseBody(c, emptyBodySchema)
  const now = Date.now()
  await deleteEmployee(c.get('db'), orgId, c.req.param('id'), now)
  return c.json({ ok: true, serverNow: now })
})
