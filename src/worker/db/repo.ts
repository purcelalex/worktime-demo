// Tenant-scoped data access. Every function takes `orgId` (taken from the
// session, never from the request) and filters by it, so one organization can
// never read or change another organization's rows.
import { and, asc, count, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import type { ActiveTimer, Employee, ReportEntry, ReportEmployee, StoppedEntry } from '../../shared/schemas'
import { LIMITS } from '../../shared/schemas'
import { AppError } from '../lib/errors'
import { clippedDuration } from '../lib/time'
import type { Db } from './client'
import { employees, timeEntries } from './schema'

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes('UNIQUE constraint failed')) return true
  }
  return false
}

export async function listEmployees(db: Db, orgId: string): Promise<Employee[]> {
  const rows = await db
    .select()
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.isActive, 1)))
    .orderBy(sql`lower(${employees.fullName})`)
  return rows.map((r) => ({ id: r.id, fullName: r.fullName, position: r.position, createdAt: r.createdAt }))
}

async function getActiveEmployee(db: Db, orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.id, id), eq(employees.isActive, 1)))
  if (!row) throw new AppError('NOT_FOUND', 'Employee not found')
  return row
}

/**
 * Removes an employee from the active list. Their time records are kept, so
 * the report history stays complete. Refused while a timer is running or paused.
 */
export async function deleteEmployee(db: Db, orgId: string, employeeId: string, now: number): Promise<void> {
  await getActiveEmployee(db, orgId, employeeId)
  const hasOpenTimer = sql`exists (select 1 from ${timeEntries} where ${timeEntries.employeeId} = ${employees.id} and (${timeEntries.stoppedAt} is null or ${timeEntries.endReason} = 'paused'))`
  // One conditional UPDATE: a timer started a moment ago cannot slip through.
  const rows = await db
    .update(employees)
    .set({ isActive: 0, deletedAt: now })
    .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId), eq(employees.isActive, 1), sql`not ${hasOpenTimer}`))
    .returning({ id: employees.id })
  if (rows.length === 0) {
    throw new AppError('CONFLICT', "Stop this employee's timer before deleting them")
  }
}

export async function createEmployee(
  db: Db,
  orgId: string,
  orgKind: 'demo' | 'real',
  input: { fullName: string; position: string | null },
  now: number,
): Promise<Employee> {
  if (orgKind === 'demo') {
    const [{ total } = { total: 0 }] = await db
      .select({ total: count() })
      .from(employees)
      .where(eq(employees.orgId, orgId))
    if (total >= LIMITS.demoEmployeeCap) {
      throw new AppError('CONFLICT', 'Employee limit reached for this demo')
    }
  }
  const row = { id: crypto.randomUUID(), orgId, fullName: input.fullName, position: input.position, isActive: 1, createdAt: now }
  try {
    await db.insert(employees).values(row)
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError('CONFLICT', 'An employee with this name already exists', {
        fullName: 'An employee with this name already exists',
      })
    }
    throw err
  }
  return { id: row.id, fullName: row.fullName, position: row.position, createdAt: row.createdAt }
}

type EntryRow = typeof timeEntries.$inferSelect

function toActive(r: EntryRow): ActiveTimer {
  return {
    id: r.id,
    employeeId: r.employeeId,
    description: r.description,
    state: r.stoppedAt === null ? 'running' : 'paused',
    startedAt: r.startedAt,
    pausedAt: r.stoppedAt,
    carriedMs: r.carriedMs,
  }
}

/** Timers that are counting or waiting to be resumed. */
export async function listActiveTimers(db: Db, orgId: string): Promise<ActiveTimer[]> {
  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.orgId, orgId), or(isNull(timeEntries.stoppedAt), eq(timeEntries.endReason, 'paused'))))
    .orderBy(asc(timeEntries.startedAt))
  return rows.map(toActive)
}

export async function startTimer(
  db: Db,
  orgId: string,
  employeeId: string,
  description: string,
  now: number,
): Promise<ActiveTimer> {
  await getActiveEmployee(db, orgId, employeeId)
  const [paused] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.employeeId, employeeId), eq(timeEntries.endReason, 'paused')))
  if (paused) throw new AppError('CONFLICT', 'This employee has a paused timer. Resume or stop it first')

  const row = {
    id: crypto.randomUUID(),
    orgId,
    employeeId,
    description,
    startedAt: now,
    stoppedAt: null,
    createdAt: now,
    endReason: null,
    carriedMs: 0,
  }
  try {
    await db.insert(timeEntries).values(row)
  } catch (err) {
    // The partial unique index allows only one running entry per employee, even
    // when two requests race.
    if (isUniqueViolation(err)) throw new AppError('CONFLICT', 'This employee already has a running timer')
    throw err
  }
  return toActive(row)
}

/** Closes the running segment and keeps the task waiting to be resumed. */
export async function pauseTimer(db: Db, orgId: string, employeeId: string, now: number): Promise<ActiveTimer> {
  await getActiveEmployee(db, orgId, employeeId)
  try {
    const [row] = await db
      .update(timeEntries)
      .set({ stoppedAt: sql`max(${now}, ${timeEntries.startedAt})`, endReason: 'paused' })
      .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.employeeId, employeeId), isNull(timeEntries.stoppedAt)))
      .returning()
    if (!row) throw new AppError('CONFLICT', 'No running timer for this employee')
    return toActive(row)
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError('CONFLICT', 'This employee already has a paused timer')
    throw err
  }
}

/** Starts a new segment of the paused task; the clock continues from the time already worked. */
export async function resumeTimer(db: Db, orgId: string, employeeId: string, now: number): Promise<ActiveTimer> {
  await getActiveEmployee(db, orgId, employeeId)
  // Claim the paused entry first. If two resumes race, only one gets a row back.
  const [paused] = await db
    .update(timeEntries)
    .set({ endReason: 'resumed' })
    .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.employeeId, employeeId), eq(timeEntries.endReason, 'paused')))
    .returning()
  if (!paused || paused.stoppedAt === null) throw new AppError('CONFLICT', 'No paused timer for this employee')

  const row = {
    id: crypto.randomUUID(),
    orgId,
    employeeId,
    description: paused.description,
    startedAt: now,
    stoppedAt: null,
    createdAt: now,
    endReason: null,
    carriedMs: paused.carriedMs + (paused.stoppedAt - paused.startedAt),
  }
  try {
    await db.insert(timeEntries).values(row)
  } catch (err) {
    // Put the pause back so no work is lost, then report the conflict.
    await db.update(timeEntries).set({ endReason: 'paused' }).where(eq(timeEntries.id, paused.id))
    if (isUniqueViolation(err)) throw new AppError('CONFLICT', 'This employee already has a running timer')
    throw err
  }
  return toActive(row)
}

/** Ends the task for good, whether it is running or paused. */
export async function stopTimer(db: Db, orgId: string, employeeId: string, now: number): Promise<StoppedEntry> {
  await getActiveEmployee(db, orgId, employeeId)
  // A single UPDATE ... RETURNING keeps the stop atomic.
  let [row] = await db
    .update(timeEntries)
    .set({ stoppedAt: sql`max(${now}, ${timeEntries.startedAt})`, endReason: 'stopped' })
    .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.employeeId, employeeId), isNull(timeEntries.stoppedAt)))
    .returning()
  if (!row) {
    // Stopping a paused task adds no time: its last segment is already closed.
    ;[row] = await db
      .update(timeEntries)
      .set({ endReason: 'stopped' })
      .where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.employeeId, employeeId), eq(timeEntries.endReason, 'paused')))
      .returning()
  }
  if (!row || row.stoppedAt === null) throw new AppError('CONFLICT', 'No running timer for this employee')
  const durationMs = row.stoppedAt - row.startedAt
  return {
    id: row.id,
    employeeId: row.employeeId,
    description: row.description,
    startedAt: row.startedAt,
    stoppedAt: row.stoppedAt,
    durationMs,
    totalMs: row.carriedMs + durationMs,
  }
}

export async function buildReport(db: Db, orgId: string, from: number, to: number, now: number) {
  // Deleted employees are included only when they have records in the period.
  const everyone = await db
    .select()
    .from(employees)
    .where(eq(employees.orgId, orgId))
    .orderBy(sql`lower(${employees.fullName})`)
  const rows = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.orgId, orgId),
        lt(timeEntries.startedAt, to),
        or(isNull(timeEntries.stoppedAt), gt(timeEntries.stoppedAt, from)),
      ),
    )
    .orderBy(desc(timeEntries.startedAt))

  const byEmployee = new Map<string, ReportEntry[]>()
  for (const r of rows) {
    const entry: ReportEntry = {
      id: r.id,
      description: r.description,
      startedAt: r.startedAt,
      stoppedAt: r.stoppedAt,
      durationMs: clippedDuration(r.startedAt, r.stoppedAt, from, to, now),
      running: r.stoppedAt === null,
    }
    const list = byEmployee.get(r.employeeId)
    if (list) list.push(entry)
    else byEmployee.set(r.employeeId, [entry])
  }

  const result: ReportEmployee[] = everyone
    .filter((p) => p.isActive === 1 || byEmployee.has(p.id))
    .map((p) => {
    const entries = byEmployee.get(p.id) ?? []
    return {
      id: p.id,
      fullName: p.fullName,
      position: p.position,
      deleted: p.isActive === 0,
      totalMs: entries.reduce((sum, e) => sum + e.durationMs, 0),
      entryCount: entries.length,
      entries,
    }
  })
  return {
    totalMs: result.reduce((sum, e) => sum + e.totalMs, 0),
    entryCount: result.reduce((sum, e) => sum + e.entryCount, 0),
    employees: result,
  }
}
