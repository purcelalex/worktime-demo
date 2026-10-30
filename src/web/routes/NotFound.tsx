import { Link } from 'react-router-dom'
import { strings } from '../strings'

export function NotFound() {
  return (
    <main className="landing-page grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-6xl font-extrabold text-brand-ink">404</p>
        <h1 className="mt-2 text-2xl font-bold">{strings.errors.notFoundTitle}</h1>
        <p className="mt-1 text-neutral">{strings.errors.notFoundText}</p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand-ink px-5 font-semibold text-white hover:bg-brand-strong"
        >
          {strings.errors.home}
        </Link>
      </div>
    </main>
  )
}
