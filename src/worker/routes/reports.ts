import { Hono } from 'hono'
import { reportQuerySchema } from '../../shared/schemas'
import type { Report } from '../../shared/schemas'
import { buildReport } from '../db/repo'
import type { AppEnv } from '../env'
import { parseQuery } from '../lib/validate'
import { requireSession } from '../middleware/session'

export const reports = new Hono<AppEnv>()
reports.use('*', requireSession)

reports.get('/summary', async (c) => {
  const { orgId } = c.get('auth')
  const { from, to } = parseQuery(c, reportQuerySchema)
  const now = Date.now()
  const body: Report = { serverNow: now, from, to, ...(await buildReport(c.get('db'), orgId, from, to, now)) }
  return c.json(body)
})
