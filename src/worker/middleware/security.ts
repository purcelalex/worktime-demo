import { createMiddleware } from 'hono/factory'
import { AppError } from '../lib/errors'
import type { AppEnv } from '../env'

/** Headers for API responses (static pages get theirs from public/_headers). */
const API_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
}

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next()
  for (const [name, value] of Object.entries(API_HEADERS)) c.res.headers.set(name, value)
})

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * CSRF defence on top of SameSite cookies: state-changing requests must come
 * from the same origin and carry a JSON content type.
 */
export const requestGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (STATE_CHANGING.has(c.req.method)) {
    const origin = c.req.header('Origin')
    if (!origin || origin !== new URL(c.req.url).origin) {
      throw new AppError('VALIDATION_ERROR', 'Request rejected')
    }
    if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json')) {
      throw new AppError('VALIDATION_ERROR', 'Request rejected')
    }
  }
  await next()
})
