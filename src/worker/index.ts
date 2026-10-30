import { Hono } from 'hono'
import { purgeExpired } from './cleanup'
import { createDb } from './db/client'
import type { AppEnv, Env } from './env'
import { AppError } from './lib/errors'
import { requestGuard, securityHeaders } from './middleware/security'
import { auth } from './routes/auth'
import { employees } from './routes/employees'
import { reports } from './routes/reports'
import { timers } from './routes/timers'

// Static pages are served by the platform; the Worker only answers /api/*.
const app = new Hono<AppEnv>().basePath('/api')

app.use('*', securityHeaders)
app.use('*', async (c, next) => {
  c.set('db', createDb(c.env.DB))
  await next()
})
app.use('*', requestGuard)

app.route('/auth', auth)
app.route('/employees', employees)
app.route('/timers', timers)
app.route('/reports', reports)

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404))

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message, fields: err.fields } }, err.status)
  }
  // Never leak internals; log only the error name so no personal data is written.
  console.error('Unhandled error:', err instanceof Error ? err.name : 'unknown')
  return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong' } }, 500)
})

export default {
  fetch: app.fetch,
  // Daily retention cleanup.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(purgeExpired(env.DB, Date.now()))
  },
} satisfies ExportedHandler<Env>
