import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { ChartIcon, ClockIcon, Logo, LogoutIcon, Skeleton, ToastProvider, UsersIcon } from '../components/ui'
import { api, setUnauthenticatedHandler } from '../lib/api'
import { useMe } from '../lib/queries'
import { strings } from '../strings'

const NAV = [
  { to: '/app/timer', label: strings.nav.timer, icon: <ClockIcon /> },
  { to: '/app/employees', label: strings.nav.employees, icon: <UsersIcon /> },
  { to: '/app/reports', label: strings.nav.reports, icon: <ChartIcon /> },
]

export function AppLayout() {
  const me = useMe()
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Any 401 from the API sends the visitor back to the login page.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      qc.clear()
      navigate('/login', { replace: true })
    })
    return () => setUnauthenticatedHandler(null)
  }, [qc, navigate])

  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      qc.clear()
      navigate('/login', { replace: true })
    },
  })

  if (me.isPending) {
    return (
      <div className="p-5" role="status" aria-label={strings.common.loading}>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    )
  }
  if (me.isError) return <Navigate to="/login" replace />

  const { organization, user } = me.data
  const demoBadge = organization.kind === 'demo' && (
    <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-bold text-brand-strong">{strings.common.demoBadge}</span>
  )

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {strings.common.skipToContent}
      </a>
      <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[16rem_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden border-r border-line bg-white p-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-lg font-bold">{strings.appName}</span>
          </div>
          <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold ${isActive ? 'bg-brand-tint text-brand-strong' : 'text-neutral hover:bg-surface'}`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto space-y-3 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              {demoBadge}
              <span className="truncate text-sm font-semibold">{user.username}</span>
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-semibold text-neutral hover:bg-surface"
            >
              <LogoutIcon />
              {strings.common.logout}
            </button>
          </div>
        </aside>

        <div className="flex min-h-dvh flex-col">
          {/* Phone header */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
            <div className="flex items-center gap-2.5">
              <Logo className="size-8" />
              <span className="font-bold">{strings.appName}</span>
              {demoBadge}
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral"
            >
              <LogoutIcon />
              {strings.common.logout}
            </button>
          </header>

          <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
            {organization.kind === 'demo' && (
              <p className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm font-medium text-warn-ink">
                {strings.privacy.demoNotice}{' '}
                <Link to="/privacy" className="font-semibold underline">
                  {strings.privacy.link}
                </Link>
              </p>
            )}
            <Outlet />
          </main>
        </div>
      </div>

      {/* Phone bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-brand-strong' : 'text-neutral'}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </ToastProvider>
  )
}
