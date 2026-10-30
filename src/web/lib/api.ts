import type {
  Employee,
  Report,
  ActiveTimer,
  SessionInfo,
  StoppedEntry,
} from '../../shared/schemas'
import { strings } from '../strings'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }
}

// Difference between the server clock and this browser's clock, learned from
// every response that carries `serverNow`. The timers use it so a wrong clock
// on the device never shows a wrong elapsed time.
let clockOffset = 0
export const getClockOffset = () => clockOffset

let onUnauthenticated: (() => void) | null = null
export function setUnauthenticatedHandler(handler: (() => void) | null) {
  onUnauthenticated = handler
}

async function request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown, quiet401 = false): Promise<T> {
  let res: Response
  try {
    const init: RequestInit =
      method === 'GET'
        ? { method, headers: { Accept: 'application/json' } }
        : {
            method,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
          }
    res = await fetch(`/api${path}`, { ...init, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'NETWORK', strings.errors.network)
  }
  const data = (await res.json().catch(() => null)) as Record<string, any> | null
  if (!res.ok) {
    if (res.status === 401 && !quiet401) onUnauthenticated?.()
    throw new ApiError(res.status, data?.error?.code ?? 'INTERNAL', data?.error?.message ?? strings.errors.generic, data?.error?.fields)
  }
  if (typeof data?.serverNow === 'number') clockOffset = data.serverNow - Date.now()
  return data as T
}

export const api = {
  login: (username: string, password: string) => request<SessionInfo>('POST', '/auth/login', { username, password }, true),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  me: () => request<SessionInfo>('GET', '/auth/me', undefined, true),
  employees: () => request<{ employees: Employee[] }>('GET', '/employees'),
  addEmployee: (fullName: string, position: string) =>
    request<{ employee: Employee }>('POST', '/employees', { fullName, position: position || undefined }),
  deleteEmployee: (employeeId: string) => request<{ ok: true }>('DELETE', `/employees/${employeeId}`),
  timers: () => request<{ serverNow: number; timers: ActiveTimer[] }>('GET', '/timers'),
  startTimer: (employeeId: string, description: string) =>
    request<{ serverNow: number; timer: ActiveTimer }>('POST', `/employees/${employeeId}/timer/start`, { description }),
  pauseTimer: (employeeId: string) =>
    request<{ serverNow: number; timer: ActiveTimer }>('POST', `/employees/${employeeId}/timer/pause`),
  resumeTimer: (employeeId: string) =>
    request<{ serverNow: number; timer: ActiveTimer }>('POST', `/employees/${employeeId}/timer/resume`),
  stopTimer: (employeeId: string) =>
    request<{ serverNow: number; entry: StoppedEntry }>('POST', `/employees/${employeeId}/timer/stop`),
  report: (from: number, to: number) => request<Report>('GET', `/reports/summary?from=${from}&to=${to}`),
}
