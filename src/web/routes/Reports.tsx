import { lazy, Suspense, useMemo, useState } from 'react'
import type { Report, ReportEmployee } from '../../shared/schemas'
import { ChevronIcon, EmptyState, ErrorState, Skeleton, inputClass } from '../components/ui'
import { formatDateTime, formatDuration } from '../lib/format'
import { customRange, rangeFor, toDateInput, type PeriodChoice } from '../lib/periods'
import { useReport } from '../lib/queries'
import { strings } from '../strings'

const HoursChart = lazy(() => import('../components/HoursChart'))

const CHIPS: PeriodChoice[] = ['today', 'week', 'month', 'custom']

export function Reports() {
  const s = strings.reports
  const [choice, setChoice] = useState<PeriodChoice>('week')
  const [fromValue, setFromValue] = useState(() => toDateInput(rangeFor('week').from))
  const [toValue, setToValue] = useState(() => toDateInput(Date.now()))

  // Recomputed only when the choice changes, so the query key stays stable.
  const range = useMemo(
    () => (choice === 'custom' ? customRange(fromValue, toValue) : rangeFor(choice)),
    [choice, fromValue, toValue],
  )
  const report = useReport(range)

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s.title}</h1>

      <div role="group" aria-label={s.title} className="mb-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={choice === c}
            onClick={() => setChoice(c)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${choice === c ? 'border-brand-ink bg-brand-ink text-white' : 'border-line bg-white text-ink hover:bg-surface'}`}
          >
            {s.periods[c]}
          </button>
        ))}
      </div>

      {choice === 'custom' && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">
            {s.from}
            <input type="date" value={fromValue} onChange={(e) => setFromValue(e.target.value)} className={`${inputClass} mt-1.5`} />
          </label>
          <label className="block text-sm font-semibold">
            {s.to}
            <input type="date" value={toValue} onChange={(e) => setToValue(e.target.value)} className={`${inputClass} mt-1.5`} />
          </label>
          {!range && (
            <p role="alert" className="col-span-2 text-sm text-danger">
              {s.invalidRange}
            </p>
          )}
        </div>
      )}

      {report.isPending && range && (
        <div className="space-y-3" role="status" aria-label={strings.common.loading}>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
      {report.isError && <ErrorState message={report.error.message} onRetry={() => void report.refetch()} />}
      {report.isSuccess && <ReportView report={report.data} />}
    </div>
  )
}

function ReportView({ report }: { report: Report }) {
  const s = strings.reports

  if (report.employees.length === 0) {
    return <EmptyState title={s.noEmployeesTitle} text={s.noEmployeesText} />
  }
  if (report.entryCount === 0) {
    return <EmptyState title={s.emptyTitle} text={s.emptyText} />
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-brand-tint p-4">
        <p className="text-sm font-semibold text-brand-strong">{s.total}</p>
        <p className="text-4xl font-extrabold tracking-tight text-brand-strong">{formatDuration(report.totalMs)}</p>
        <p className="text-sm text-neutral">{s.records(report.entryCount)}</p>
      </div>

      <section aria-labelledby="chart-title" className="rounded-2xl border border-line bg-white p-4">
        <h2 id="chart-title" className="mb-3 font-bold">
          {s.chartTitle}
        </h2>
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <HoursChart employees={report.employees} />
        </Suspense>
      </section>

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {report.employees.map((e) => (
          <EmployeeRow key={e.id} employee={e} />
        ))}
      </ul>
    </div>
  )
}

function EmployeeRow({ employee }: { employee: ReportEmployee }) {
  const s = strings.reports
  const [open, setOpen] = useState(false)
  const panelId = `records-${employee.id}`
  const expandable = employee.entryCount > 0

  return (
    <li>
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left enabled:hover:bg-surface"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{employee.fullName}</span>
            {employee.deleted && (
              <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-neutral">{s.deletedBadge}</span>
            )}
          </span>
          <span className="block text-sm text-neutral">{s.records(employee.entryCount)}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-lg font-bold text-brand-strong">{formatDuration(employee.totalMs)}</span>
          {expandable && <ChevronIcon open={open} />}
        </span>
      </button>

      {open && expandable && (
        <div id={panelId} className="border-t border-line bg-surface/50 px-4 py-3">
          {/* Phone: stacked cards. Desktop: a real table. */}
          <ul className="space-y-2 lg:hidden">
            {employee.entries.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-white p-3">
                <p className="break-words font-semibold">{r.description}</p>
                <p className="text-sm text-neutral">
                  {formatDateTime(r.startedAt)} to {r.stoppedAt ? formatDateTime(r.stoppedAt) : s.runningLabel}
                </p>
                <p className="mt-1 font-bold text-brand-strong">{formatDuration(r.durationMs)}</p>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-left text-sm lg:table">
            <thead className="text-neutral">
              <tr>
                <th scope="col" className="py-2 pr-3 font-semibold">{s.task}</th>
                <th scope="col" className="py-2 pr-3 font-semibold">{s.start}</th>
                <th scope="col" className="py-2 pr-3 font-semibold">{s.stop}</th>
                <th scope="col" className="py-2 text-right font-semibold">{s.duration}</th>
              </tr>
            </thead>
            <tbody>
              {employee.entries.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2 pr-3">{r.description}</td>
                  <td className="py-2 pr-3">{formatDateTime(r.startedAt)}</td>
                  <td className="py-2 pr-3">{r.stoppedAt ? formatDateTime(r.stoppedAt) : s.runningLabel}</td>
                  <td className="py-2 text-right font-semibold">{formatDuration(r.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  )
}
