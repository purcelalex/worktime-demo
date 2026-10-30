import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/ui'
import { strings } from '../../strings'

/** Demo module: the privacy notice (the production edition ships its own). */
export function Privacy() {
  const s = strings.privacy
  useEffect(() => {
    const previous = document.title
    document.title = `${s.title} | ${strings.appName}`
    return () => {
      document.title = previous
    }
  }, [s.title])

  return (
    <div className="landing-page min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-5">
        <Logo />
        <span className="text-lg font-bold">{strings.appName}</span>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight">{s.title}</h1>
        <p className="mt-1 text-sm text-neutral">{s.updated}</p>
        <div className="mt-6 space-y-6">
          {s.sections.map((section) => (
            <section key={section.heading} className="rounded-2xl border border-line bg-white/85 p-5">
              <h2 className="text-lg font-bold">{section.heading}</h2>
              {section.paragraphs.length > 2 ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral">
                  {section.paragraphs.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                section.paragraphs.map((p) => (
                  <p key={p} className="mt-2 text-neutral">
                    {p}
                  </p>
                ))
              )}
            </section>
          ))}
        </div>
        <Link to="/" className="mt-8 inline-flex min-h-11 items-center rounded-xl px-2 font-semibold text-brand-ink hover:underline">
          {s.back}
        </Link>
      </main>
    </div>
  )
}
