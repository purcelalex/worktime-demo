import { Hono } from 'hono'
import { listActiveTimers } from '../db/repo'
import type { AppEnv } from '../env'
import { requireSession } from '../middleware/session'

export const timers = new Hono<AppEnv>()
timers.use('*', requireSession)

timers.get('/', async (c) => {
  const { orgId } = c.get('auth')
  const list = await listActiveTimers(c.get('db'), orgId)
  return c.json({ serverNow: Date.now(), timers: list })
})
