import { z } from 'zod'
import { LIMITS } from './limits'

// Server-side validation. The browser must import only types from this file
// (and LIMITS from ./limits), so zod stays out of the client bundle.
export { LIMITS }

const noControlChars = /^[^\p{Cc}]*$/u

const text = (max: number, label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .regex(noControlChars, `${label} contains invalid characters`)

export const loginSchema = z.strictObject({
  username: z.string().trim().min(1, 'Account is required').max(100),
  password: z.string().min(1, 'Password is required').max(200),
})

export const createEmployeeSchema = z.strictObject({
  fullName: text(LIMITS.fullName, 'Full name'),
  position: z
    .string()
    .trim()
    .max(LIMITS.position, `Position must be at most ${LIMITS.position} characters`)
    .regex(noControlChars, 'Position contains invalid characters')
    .optional()
    .transform((v) => (v ? v : null)),
})

export const startTimerSchema = z.strictObject({
  description: text(LIMITS.description, 'Task description'),
})

export const emptyBodySchema = z.strictObject({})

const timestamp = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be an integer`)
    .min(LIMITS.minTimestamp, `${label} is out of range`)
    .max(LIMITS.maxTimestamp, `${label} is out of range`)

export const reportQuerySchema = z
  .object({ from: timestamp('from'), to: timestamp('to') })
  .refine((q) => q.from <= q.to, { message: '"from" must not be after "to"', path: ['from'] })
  .refine((q) => q.to - q.from <= LIMITS.maxPeriodMs, {
    message: 'The period must not exceed 366 days',
    path: ['to'],
  })

// ---- Response shapes (used by the UI) ----

export interface UserInfo {
  id: string
  username: string
  role: 'owner' | 'admin' | 'manager' | 'employee'
}
export interface OrganizationInfo {
  id: string
  name: string
  kind: 'demo' | 'real'
}
export interface SessionInfo {
  user: UserInfo
  organization: OrganizationInfo
  serverNow: number
}
export interface Employee {
  id: string
  fullName: string
  position: string | null
  createdAt: number
}
/**
 * A timer that is either counting ("running") or waiting to be resumed
 * ("paused"). Time worked on the task so far is
 *   running: carriedMs + (now - startedAt)
 *   paused:  carriedMs + (pausedAt - startedAt)
 */
export interface ActiveTimer {
  id: string
  employeeId: string
  description: string
  state: 'running' | 'paused'
  /** Start of the current segment (after a resume, the moment of the resume). */
  startedAt: number
  /** Set while paused. */
  pausedAt: number | null
  /** Time already worked on this task before the current segment. */
  carriedMs: number
}
export interface StoppedEntry {
  id: string
  employeeId: string
  description: string
  startedAt: number
  stoppedAt: number
  /** Length of the last segment only. */
  durationMs: number
  /** Total time worked on the task, across all segments. */
  totalMs: number
}
export interface ReportEntry {
  id: string
  description: string
  startedAt: number
  stoppedAt: number | null
  durationMs: number
  running: boolean
}
export interface ReportEmployee {
  id: string
  fullName: string
  position: string | null
  /** Deleted from the list; shown only because they have records in the period. */
  deleted: boolean
  totalMs: number
  entryCount: number
  entries: ReportEntry[]
}
export interface Report {
  serverNow: number
  from: number
  to: number
  totalMs: number
  entryCount: number
  employees: ReportEmployee[]
}
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}
