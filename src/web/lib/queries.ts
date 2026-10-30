import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ActiveTimer } from '../../shared/schemas'
import { api, getClockOffset } from './api'

export const keys = {
  me: ['me'] as const,
  employees: ['employees'] as const,
  timers: ['timers'] as const,
  report: (from: number, to: number) => ['report', from, to] as const,
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: api.me, retry: false, staleTime: 60_000 })
}

export function useEmployees() {
  return useQuery({ queryKey: keys.employees, queryFn: async () => (await api.employees()).employees })
}

export function useTimers() {
  return useQuery({
    queryKey: keys.timers,
    queryFn: async () => (await api.timers()).timers,
    refetchInterval: 30_000, // pick up timers started from another device
  })
}

export function useReport(range: { from: number; to: number } | null) {
  return useQuery({
    queryKey: range ? keys.report(range.from, range.to) : ['report', 'none'],
    queryFn: () => api.report(range!.from, range!.to),
    enabled: range !== null,
  })
}

export function useAddEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { fullName: string; position: string }) => api.addEmployee(v.fullName, v.position),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.employees }),
  })
}

/** Removes an employee from the list; their history stays in the reports. */
export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (employeeId: string) => api.deleteEmployee(employeeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.employees })
      void qc.invalidateQueries({ queryKey: keys.timers })
      void qc.invalidateQueries({ queryKey: ['report'] })
    },
  })
}

/**
 * Timer actions update the card at once (optimistic) and roll back if the
 * server refuses. `change` returns the new list of active timers.
 */
function useTimerMutation<TVariables, TData>(
  mutationFn: (v: TVariables) => Promise<TData>,
  change: (timers: ActiveTimer[], v: TVariables, now: number) => ActiveTimer[],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onMutate: async (v: TVariables) => {
      await qc.cancelQueries({ queryKey: keys.timers })
      const previous = qc.getQueryData<ActiveTimer[]>(keys.timers)
      qc.setQueryData<ActiveTimer[]>(keys.timers, change(previous ?? [], v, Date.now() + getClockOffset()))
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(keys.timers, ctx?.previous),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.timers })
      void qc.invalidateQueries({ queryKey: ['report'] })
    },
  })
}

const without = (timers: ActiveTimer[], employeeId: string) => timers.filter((t) => t.employeeId !== employeeId)

export function useStartTimer() {
  return useTimerMutation(
    (v: { employeeId: string; description: string }) => api.startTimer(v.employeeId, v.description),
    (timers, v, now) => [
      ...timers,
      {
        id: `pending-${v.employeeId}`,
        employeeId: v.employeeId,
        description: v.description,
        state: 'running',
        startedAt: now,
        pausedAt: null,
        carriedMs: 0,
      },
    ],
  )
}

export function usePauseTimer() {
  return useTimerMutation(api.pauseTimer, (timers, employeeId, now) =>
    timers.map((t) => (t.employeeId === employeeId && t.state === 'running' ? { ...t, state: 'paused', pausedAt: now } : t)),
  )
}

export function useResumeTimer() {
  return useTimerMutation(api.resumeTimer, (timers, employeeId, now) =>
    timers.map((t) =>
      t.employeeId === employeeId && t.state === 'paused' && t.pausedAt !== null
        ? { ...t, state: 'running', startedAt: now, pausedAt: null, carriedMs: t.carriedMs + (t.pausedAt - t.startedAt) }
        : t,
    ),
  )
}

export function useStopTimer() {
  return useTimerMutation(api.stopTimer, without)
}
