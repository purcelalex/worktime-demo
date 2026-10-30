import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button, Field, Logo, inputClass } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { keys, useMe } from '../lib/queries'
import { LoginNotice } from '../modules/registry'
import { strings } from '../strings'

export function Login() {
  const s = strings.login
  const navigate = useNavigate()
  const qc = useQueryClient()
  const me = useMe()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)

  const login = useMutation({
    mutationFn: () => api.login(username.trim(), password),
    onSuccess: (session) => {
      qc.setQueryData(keys.me, session)
      navigate('/app/timer', { replace: true })
    },
  })

  if (me.isSuccess) return <Navigate to="/app/timer" replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!login.isPending) login.mutate()
  }
  const error = login.error instanceof ApiError ? login.error.message : login.error ? strings.errors.generic : undefined

  return (
    <div className="landing-page grid min-h-dvh place-items-center px-5 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <Logo />
          <span className="text-lg font-bold">{strings.appName}</span>
        </div>
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight">{s.title}</h1>
        <LoginNotice />
        <form onSubmit={onSubmit} className="mt-5 space-y-4 rounded-3xl border border-line bg-white p-5 shadow-sm" noValidate>
          <Field label={s.account}>
            {(p) => (
              <input
                {...p}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            )}
          </Field>
          <Field label={s.password}>
            {(p) => (
              <div className="relative">
                <input
                  {...p}
                  type={reveal ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-20`}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-pressed={reveal}
                  className="absolute inset-y-0 right-1 my-1 rounded-lg px-3 text-sm font-semibold text-brand-ink hover:bg-brand-tint"
                >
                  {reveal ? s.hide : s.show}
                </button>
              </div>
            )}
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={login.isPending || !username || !password} className="w-full">
            {login.isPending ? s.submitting : s.submit}
          </Button>
        </form>
        <div className="mt-5 flex items-center gap-5">
          <Link to="/" className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-brand-ink hover:underline">
            {s.back}
          </Link>
          <Link to="/privacy" className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-brand-ink hover:underline">
            {strings.privacy.link}
          </Link>
        </div>
      </main>
    </div>
  )
}
