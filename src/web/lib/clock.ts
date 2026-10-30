import { useEffect, useState } from 'react'
import { getClockOffset } from './api'

/** The current server time in ms, re-rendered every second while `active`. */
export function useServerNow(active = true): number {
  const [now, setNow] = useState(() => Date.now() + getClockOffset())
  useEffect(() => {
    if (!active) return
    setNow(Date.now() + getClockOffset())
    const id = window.setInterval(() => setNow(Date.now() + getClockOffset()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}
