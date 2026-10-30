import { strings } from '../../strings'

/** Demo module: makes clear that the login is for test accounts. */
export function LoginNotice() {
  return (
    <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm font-semibold text-warn-ink">
      {strings.login.banner}
    </p>
  )
}
