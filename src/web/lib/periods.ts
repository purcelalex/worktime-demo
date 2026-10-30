import { LIMITS } from '../../shared/limits'

export type PeriodChoice = 'today' | 'week' | 'month' | 'custom'

export interface Range {
  from: number
  to: number
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()

/** Local calendar days in the browser's time zone, converted to UTC instants. */
export function rangeFor(choice: Exclude<PeriodChoice, 'custom'>, now = new Date()): Range {
  const back = choice === 'today' ? 0 : choice === 'week' ? 6 : 29
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
  return { from: startOfDay(first), to: endOfDay(now) }
}

/** Parses two `YYYY-MM-DD` input values (inclusive). Returns null when invalid. */
export function customRange(fromValue: string, toValue: string): Range | null {
  if (!fromValue || !toValue) return null
  const [fy, fm, fd] = fromValue.split('-').map(Number)
  const [ty, tm, td] = toValue.split('-').map(Number)
  if (!fy || !fm || !fd || !ty || !tm || !td) return null
  const from = startOfDay(new Date(fy, fm - 1, fd))
  const to = endOfDay(new Date(ty, tm - 1, td))
  if (from > to || to - from > LIMITS.maxPeriodMs) return null
  return { from, to }
}

export function toDateInput(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
