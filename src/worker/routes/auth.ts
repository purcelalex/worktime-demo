import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { loginSchema, emptyBodySchema } from '../../shared/schemas'
import type { SessionInfo } from '../../shared/schemas'
import { organizations, sessions, users } from '../db/schema'
import type { AppEnv } from '../env'
import { AppError } from '../lib/errors'
import { verifyDummy, verifyPassword } from '../lib/password'
import {
  MAX_FAILURES_PER_IP,
  MAX_FAILURES_PER_USER,
  clearFailures,
  isLimited,
  registerFailure,
} from '../lib/rate-limit'
import { SESSION_COOKIE, SESSION_TTL_MS, hashToken, newSessionToken } from '../lib/session'
import { parseBody } from '../lib/validate'
import { requireSession } from '../middleware/session'

const GENERIC_LOGIN_ERROR = 'Invalid account or password'

export const auth = new Hono<AppEnv>()

auth.post('/login', async (c) => {
  const { username, password } = await parseBody(c, loginSchema)
  const now = Date.now()
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const limits = [
    { key: `user:${username.toLowerCase()}`, max: MAX_FAILURES_PER_USER },
    { key: `ip:${ip}`, max: MAX_FAILURES_PER_IP },
  ]
  const keys = limits.map((l) => l.key)

  if (await isLimited(c.env.DB, limits, now)) {
    throw new AppError('RATE_LIMITED', 'Too many attempts. Try again in a few minutes.')
  }

  const db = c.get('db')
  const [user] = await db.select().from(users).where(eq(users.username, username))
  const ok = user && user.isActive === 1 ? await verifyPassword(password, user.passwordHash) : await verifyDummy(password)
  if (!user || !ok) {
    await registerFailure(c.env.DB, keys, now)
    throw new AppError('UNAUTHENTICATED', GENERIC_LOGIN_ERROR)
  }
  await clearFailures(c.env.DB, keys[0]!)

  const [org] = await db.select().from(organizations).where(eq(organizations.id, user.orgId))
  if (!org) throw new AppError('UNAUTHENTICATED', GENERIC_LOGIN_ERROR)

  const token = newSessionToken()
  await db.insert(sessions).values({
    tokenHash: await hashToken(token),
    userId: user.id,
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
  })
  setCookie(c, SESSION_COOKIE, token, {
    prefix: 'host', // __Host-: Secure, Path=/, no Domain, so it never leaves this exact host
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
  const body: SessionInfo = {
    user: { id: user.id, username: user.username, role: user.role },
    organization: { id: org.id, name: org.name, kind: org.kind },
    serverNow: now,
  }
  return c.json(body)
})

auth.post('/logout', async (c) => {
  await parseBody(c, emptyBodySchema)
  const token = getCookie(c, SESSION_COOKIE, 'host')
  if (token) await c.get('db').delete(sessions).where(eq(sessions.tokenHash, await hashToken(token)))
  deleteCookie(c, SESSION_COOKIE, { prefix: 'host', secure: true, path: '/' })
  return c.json({ ok: true })
})

auth.get('/me', requireSession, (c) => {
  const a = c.get('auth')
  const body: SessionInfo = {
    user: { id: a.userId, username: a.username, role: a.role },
    organization: { id: a.orgId, name: a.orgName, kind: a.orgKind },
    serverNow: Date.now(),
  }
  return c.json(body)
})
