// Storage limitation (GDPR Art. 5(1)(e)): delete data we no longer need.
// Runs once a day from a Cron Trigger (see wrangler.jsonc).
const THROTTLE_RETENTION_MS = 24 * 60 * 60 * 1000

export interface PurgeResult {
  sessions: number
  loginAttempts: number
}

export async function purgeExpired(d1: D1Database, now: number): Promise<PurgeResult> {
  const [sessions, attempts] = await d1.batch([
    // Expired sign-ins.
    d1.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    // Login throttling rows hold client IP addresses; the window is 15 minutes,
    // so anything older than a day is no longer useful.
    d1.prepare('DELETE FROM login_attempts WHERE window_start <= ?').bind(now - THROTTLE_RETENTION_MS),
  ])
  return { sessions: sessions?.meta.changes ?? 0, loginAttempts: attempts?.meta.changes ?? 0 }
}
