import { Link } from 'react-router-dom'
import { Logo } from '../../components/ui'
import { useMe } from '../../lib/queries'
import { strings } from '../../strings'

/** Demo module: the public start page with the "Explore the demo" button. */
export function Landing() {
  const me = useMe()
  const signedIn = me.isSuccess
  const s = strings.landing

  return (
    <div className="landing-page min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-bold">{strings.appName}</span>
        </div>
        <span className="rounded-full bg-brand-tint px-3 py-1 text-sm font-semibold text-brand-strong">{strings.demoNote}</span>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-5 pb-16 pt-6 lg:grid-cols-2 lg:items-center lg:pt-16">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">
            Know where your team's <span className="text-brand-ink">time</span> goes.
          </h1>
          <p className="mt-4 max-w-md text-lg text-neutral">{strings.tagline}</p>
          <Link
            to={signedIn ? '/app/timer' : '/login'}
            className="mt-8 flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand-ink px-8 text-lg font-bold text-white shadow-lg shadow-brand-ink/25 transition-colors hover:bg-brand-strong sm:inline-flex sm:w-auto"
          >
            {signedIn ? s.openApp : s.explore}
          </Link>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {s.features.map((f) => (
              <li key={f.title} className="rounded-2xl border border-line bg-white/80 p-4">
                <h2 className="font-bold">{f.title}</h2>
                <p className="mt-1 text-sm text-neutral">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* A real HTML picture of the product (decorative). */}
        <div aria-hidden="true" className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-white p-5 shadow-xl">
          <p className="text-sm font-semibold text-neutral">{s.previewTitle}</p>
          <div className="mt-3 rounded-2xl bg-brand-tint p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-strong">
              <span className="pulse-dot size-2.5 rounded-full bg-brand" />
              {strings.timer.running}
            </div>
            <p className="mt-2 font-bold">{s.previewEmployee}</p>
            <p className="text-sm text-neutral">{s.previewTask}</p>
            <p className="mt-3 text-4xl font-extrabold tracking-tight text-brand-strong">01:24:36</p>
          </div>
          <div className="mt-4 space-y-2">
            {[72, 54, 38].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 flex-1 rounded-full bg-surface">
                  <div className="h-3 rounded-full bg-brand" style={{ width: `${w}%` }} />
                </div>
                <span className="w-12 text-right text-sm text-neutral">{[7.2, 5.4, 3.8][i]}h</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <footer className="mx-auto max-w-5xl px-5 pb-8 text-sm text-neutral">
        <Link to="/privacy" className="inline-flex min-h-11 items-center rounded-md font-semibold text-brand-ink hover:underline">
          {strings.privacy.link}
        </Link>
      </footer>
    </div>
  )
}
