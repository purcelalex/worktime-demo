import { and, eq, gt } from 'drizzle-orm'
import { deleteCookie, getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { organizations, sessions, users } from '../db/schema'
import { AppError } from '../lib/errors'
import { SESSION_COOKIE, hashToken } from '../lib/session'
import type { AppEnv } from '../env'

/** Requires a valid session and exposes the caller (and their organization) as `auth`. */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE, 'host')
  if (!token) throw new AppError('UNAUTHENTICATED', 'Sign in required')

  const db = c.get('db')
  const tokenHash = await hashToken(token)
  const [row] = await db
    .select({
      userId: users.id,
      username: users.username,
      role: users.role,
      orgId: organizations.id,
      orgName: organizations.name,
      orgKind: organizations.kind,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, Date.now()), eq(users.isActive, 1)))

  if (!row) {
    // Unknown or expired: drop the stale row and cookie.
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
    deleteCookie(c, SESSION_COOKIE, { prefix: 'host', secure: true, path: '/' })
    throw new AppError('UNAUTHENTICATED', 'Sign in required')
  }
  c.set('auth', row)
  await next()
})
