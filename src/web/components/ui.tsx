import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { strings } from '../strings'

// ---------- Button ----------

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-ink text-white hover:bg-brand-strong active:bg-brand-strong',
  secondary: 'border border-line bg-white text-ink hover:bg-surface',
  danger: 'bg-danger text-white hover:bg-danger-strong active:bg-danger-strong',
  ghost: 'text-brand-ink hover:bg-brand-tint',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    />
  )
}

// ---------- Form field ----------

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string | undefined
  hint?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode
}) {
  const id = useId()
  const messageId = `${id}-msg`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? messageId : undefined })}
      {(error || hint) && (
        <p id={messageId} role={error ? 'alert' : undefined} className={`text-sm ${error ? 'text-danger' : 'text-neutral'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'block min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-ink placeholder:text-neutral/70 aria-[invalid=true]:border-danger'

// ---------- Sheet (bottom sheet on phones, dialog on desktop) ----------
// Built on the native <dialog>: focus trap, Escape to close, inert background
// and focus return to the trigger all come from the browser.

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() focuses the first control (the close button). Move focus to
      // the field marked data-autofocus; React's autoFocus runs too early here.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // click on the backdrop
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/40 lg:m-auto lg:max-w-md lg:rounded-3xl"
    >
      {open && (
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={strings.common.cancel}
              className="-mr-2 -mt-1 grid size-11 place-items-center rounded-full text-neutral hover:bg-surface"
            >
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

// ---------- Toasts ----------

interface Toast {
  id: number
  message: string
  tone: 'ok' | 'error'
}
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const push = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])
  const value = useMemo(() => push, [push])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === 'error' ? 'bg-danger' : 'bg-ink'}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ---------- Placeholders ----------

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-surface ${className}`} />
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand-tint text-brand-ink">
        <ClockIcon />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-neutral">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-white px-6 py-8 text-center">
      <p className="text-danger">{message}</p>
      <Button variant="secondary" onClick={onRetry} className="mt-4">
        {strings.common.retry}
      </Button>
    </div>
  )
}

// ---------- Icons (decorative; always paired with text or an aria-label) ----------

const svgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const ClockIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const UsersIcon = () => (
  <svg {...svgProps}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5" />
    <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.9.7 3 2.5 3.3 5.2" />
  </svg>
)
export const ChartIcon = () => (
  <svg {...svgProps}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)
export const LogoutIcon = () => (
  <svg {...svgProps}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
)
export const CloseIcon = () => (
  <svg {...svgProps}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const PlusIcon = () => (
  <svg {...svgProps}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg {...svgProps} className={`transition-transform ${open ? 'rotate-180' : ''}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const TrashIcon = () => (
  <svg {...svgProps}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6M10 11v6M14 11v6" />
  </svg>
)
export const SearchIcon = () => (
  <svg {...svgProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl bg-brand-ink text-white ${className}`}>
      <ClockIcon />
    </span>
  )
}
