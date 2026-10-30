import type { ReportEmployee } from '../../shared/schemas'
import { hoursOf } from '../lib/format'

/** Horizontal bars, one per employee. Plain HTML so it is light, sharp and CSP-friendly. */
export default function HoursChart({ employees }: { employees: ReportEmployee[] }) {
  const max = Math.max(...employees.map((e) => e.totalMs), 1)
  return (
    <ul className="space-y-2.5">
      {employees.map((e) => (
        <li key={e.id} className="grid grid-cols-[minmax(0,7rem)_1fr_3.25rem] items-center gap-3 text-sm lg:grid-cols-[minmax(0,10rem)_1fr_3.5rem]">
          <span className="truncate font-medium">{e.fullName}</span>
          <span className="h-3 rounded-full bg-surface" aria-hidden="true">
            <span className="block h-3 rounded-full bg-brand" style={{ width: `${Math.max((e.totalMs / max) * 100, e.totalMs > 0 ? 2 : 0)}%` }} />
          </span>
          <span className="text-right font-semibold text-neutral">{hoursOf(e.totalMs)}h</span>
        </li>
      ))}
    </ul>
  )
}
