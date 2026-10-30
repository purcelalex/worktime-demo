import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { ActiveTimer, Employee } from '../../shared/schemas'
import { LIMITS } from '../../shared/limits'
import { Button, EmptyState, ErrorState, Field, Sheet, Skeleton, inputClass, useToast } from '../components/ui'
import { ApiError } from '../lib/api'
import { useServerNow } from '../lib/clock'
import { formatClock, formatDuration, formatTime } from '../lib/format'
import { useEmployees, usePauseTimer, useResumeTimer, useStartTimer, useStopTimer, useTimers } from '../lib/queries'
import { strings } from '../strings'

/** Time worked on the task so far: the clock stops while paused. */
function workedMs(timer: ActiveTimer, now: number): number {
  const until = timer.state === 'paused' && timer.pausedAt !== null ? timer.pausedAt : now
  return timer.carriedMs + Math.max(0, until - timer.startedAt)
}

export function Timer() {
  const s = strings.timer
  const employees = useEmployees()
  const timers = useTimers()
  const toast = useToast()
  const start = useStartTimer()
  const stop = useStopTimer()
  const pause = usePauseTimer()
  const resume = useResumeTimer()
  const [starting, setStarting] = useState<Employee | null>(null)
  const [description, setDescription] = useState('')
  const [fieldError, setFieldError] = useState<string>()

  const running = useMemo(() => new Map((timers.data ?? []).map((t) => [t.employeeId, t])), [timers.data])
  const hasRunning = (timers.data ?? []).some((t) => t.state === 'running')
  const now = useServerNow(hasRunning)

  const sorted = useMemo(() => {
    const list = [...(employees.data ?? [])]
    return list.sort((a, b) => {
      const ra = running.get(a.id)
      const rb = running.get(b.id)
      const rank = (x?: ActiveTimer) => (x ? (x.state === 'running' ? 0 : 1) : 2) // running, paused, idle
      if (rank(ra) !== rank(rb)) return rank(ra) - rank(rb)
      if (ra && rb) return ra.startedAt - rb.startedAt
      return a.fullName.localeCompare(b.fullName)
    })
  }, [employees.data, running])

  const closeSheet = () => {
    setStarting(null)
    setDescription('')
    setFieldError(undefined)
  }

  const submitStart = (e: FormEvent) => {
    e.preventDefault()
    if (!starting) return
    const text = description.trim()
    if (!text) {
      setFieldError('Task description is required')
      return
    }
    const employee = starting
    closeSheet()
    start.mutate(
      { employeeId: employee.id, description: text },
      {
        onSuccess: () => toast(s.started(employee.fullName)),
        onError: (err) => toast(err instanceof ApiError ? err.message : strings.errors.generic, 'error'),
      },
    )
  }

  const stopTimer = (employee: Employee) => {
    stop.mutate(employee.id, {
      onSuccess: (r) => toast(s.stopped(employee.fullName, formatDuration(r.entry.totalMs))),
      onError: (err) => toast(err instanceof ApiError ? err.message : strings.errors.generic, 'error'),
    })
  }

  const changeTimer = (kind: 'pause' | 'resume', employee: Employee) => {
    const action = kind === 'pause' ? pause : resume
    action.mutate(employee.id, {
      onSuccess: () => toast(kind === 'pause' ? s.pausedToast(employee.fullName) : s.resumedToast(employee.fullName)),
      onError: (err) => toast(err instanceof ApiError ? err.message : strings.errors.generic, 'error'),
    })
  }

  if (employees.isPending || timers.isPending) {
    return (
      <div className="space-y-3" role="status" aria-label={strings.common.loading}>
        <Skeleton className="h-8 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }
  if (employees.isError || timers.isError) {
    return (
      <ErrorState
        message={(employees.error ?? timers.error)?.message ?? strings.errors.generic}
        onRetry={() => {
          void employees.refetch()
          void timers.refetch()
        }}
      />
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s.title}</h1>

      {sorted.length === 0 ? (
        <EmptyState
          title={s.emptyTitle}
          text={s.emptyText}
          action={
            <Link
              to="/app/employees"
              className="inline-flex min-h-11 items-center rounded-xl bg-brand-ink px-4 font-semibold text-white hover:bg-brand-strong"
            >
              {s.emptyAction}
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {sorted.map((employee) => {
            const timer = running.get(employee.id)
            const paused = timer?.state === 'paused'
            return (
              <li
                key={employee.id}
                className={`rounded-2xl border bg-white p-4 ${
                  !timer ? 'border-line' : paused ? 'border-warn/60 shadow-md shadow-warn/15' : 'border-brand shadow-md shadow-brand/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{employee.fullName}</h2>
                    {employee.position && <p className="truncate text-sm text-neutral">{employee.position}</p>}
                  </div>
                  {!timer && (
                    <Button onClick={() => setStarting(employee)} aria-label={`${s.start} ${employee.fullName}`}>
                      {s.start}
                    </Button>
                  )}
                </div>
                {timer && (
                  <>
                    <div className={`mt-3 rounded-xl p-3 ${paused ? 'bg-warn/10' : 'bg-brand-tint'}`}>
                      <div className={`flex items-center gap-2 text-sm font-semibold ${paused ? 'text-warn-ink' : 'text-brand-strong'}`}>
                        <span
                          className={`size-2.5 rounded-full ${paused ? 'bg-warn' : 'pulse-dot bg-brand'}`}
                          aria-hidden="true"
                        />
                        <span>{paused ? s.paused : s.running}</span>
                        <span className="font-normal text-neutral">
                          {paused && timer.pausedAt !== null ? s.pausedAt(formatTime(timer.pausedAt)) : s.since(formatTime(timer.startedAt))}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm">{timer.description}</p>
                      {/* The clock is not a live region: it would be announced every second. */}
                      <p className={`mt-1 text-4xl font-extrabold tracking-tight ${paused ? 'text-warn-ink' : 'text-brand-strong'}`}>
                        {formatClock(workedMs(timer, now))}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {paused ? (
                        <Button onClick={() => changeTimer('resume', employee)} aria-label={`${s.resume} ${employee.fullName}`}>
                          {s.resume}
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => changeTimer('pause', employee)} aria-label={`${s.pause} ${employee.fullName}`}>
                          {s.pause}
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => stopTimer(employee)} aria-label={`${s.stop} ${employee.fullName}`}>
                        {s.stop}
                      </Button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={starting !== null} onClose={closeSheet} title={starting ? s.startSheetFor(starting.fullName) : s.startSheetTitle}>
        <form onSubmit={submitStart} className="space-y-4" noValidate>
          <Field label={s.description} error={fieldError}>
            {(p) => (
              <>
                <textarea
                  {...p}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    setFieldError(undefined)
                  }}
                  maxLength={LIMITS.description}
                  rows={3}
                  className={inputClass}
                  data-autofocus
                />
                <p className="text-right text-xs text-neutral">
                  {description.length}/{LIMITS.description}
                </p>
              </>
            )}
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={closeSheet} className="flex-1">
              {strings.common.cancel}
            </Button>
            <Button type="submit" className="flex-1">
              {s.startTimer}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
