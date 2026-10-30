// Login throttling per 15-minute window: 5 failures per username, 20 per IP.
// The IP limit is higher because several people at one company (one shared
// public IP) may be testing different demo accounts at the same time.
const WINDOW_MS = 15 * 60 * 1000
export const MAX_FAILURES_PER_USER = 5
export const MAX_FAILURES_PER_IP = 20

export interface LimitKey {
  key: string
  max: number
}

export async function isLimited(d1: D1Database, keys: LimitKey[], now: number): Promise<boolean> {
  const rows = await d1.batch(
    keys.map(({ key }) => d1.prepare('SELECT count FROM login_attempts WHERE key = ? AND window_start > ?').bind(key, now - WINDOW_MS)),
  )
  return rows.some((r, i) => ((r.results[0] as { count: number } | undefined)?.count ?? 0) >= keys[i]!.max)
}

export async function registerFailure(d1: D1Database, keys: string[], now: number): Promise<void> {
  const stmt = d1.prepare(
    `INSERT INTO login_attempts (key, count, window_start) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END`,
  )
  await d1.batch(keys.map((key) => stmt.bind(key, now, now - WINDOW_MS)))
}

export async function clearFailures(d1: D1Database, key: string): Promise<void> {
  await d1.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run()
}
