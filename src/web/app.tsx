import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Skeleton } from './components/ui'
import { ApiError } from './lib/api'
import { Landing, Privacy } from './modules/registry'
import { Login } from './routes/Login'
import { NotFound } from './routes/NotFound'

// The signed-in application is loaded only after sign-in, keeping the first
// page (landing and login) small.
const AppLayout = lazy(() => import('./routes/AppLayout').then((m) => ({ default: m.AppLayout })))
const Timer = lazy(() => import('./routes/Timer').then((m) => ({ default: m.Timer })))
const Employees = lazy(() => import('./routes/Employees').then((m) => ({ default: m.Employees })))
const Reports = lazy(() => import('./routes/Reports').then((m) => ({ default: m.Reports })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      // Retry network blips, never client errors.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500 && error.status !== 0) && count < 2,
    },
  },
})

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<Skeleton className="m-5 h-40" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="timer" replace />} />
              <Route path="timer" element={<Timer />} />
              <Route path="employees" element={<Employees />} />
              <Route path="reports" element={<Reports />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
