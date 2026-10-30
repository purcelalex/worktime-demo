/** True when an entry overlaps the period [from, to]. */
export function belongsToPeriod(startedAt: number, stoppedAt: number | null, from: number, to: number): boolean {
  return startedAt < to && (stoppedAt === null || stoppedAt > from)
}

/**
 * Duration of an entry inside the period. The entry is clipped to the period
 * boundaries; a running entry counts up to `now`. Never negative.
 */
export function clippedDuration(
  startedAt: number,
  stoppedAt: number | null,
  from: number,
  to: number,
  now: number,
): number {
  const end = Math.min(stoppedAt ?? now, to)
  const start = Math.max(startedAt, from)
  return Math.max(0, end - start)
}
