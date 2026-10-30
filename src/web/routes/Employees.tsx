import { useMemo, useState, type FormEvent } from 'react'
import { LIMITS } from '../../shared/limits'
import { Button, EmptyState, ErrorState, Field, PlusIcon, SearchIcon, Sheet, Skeleton, TrashIcon, inputClass, useToast } from '../components/ui'
import { ApiError } from '../lib/api'
import { formatDate } from '../lib/format'
import { useAddEmployee, useDeleteEmployee, useEmployees, useMe } from '../lib/queries'
import { strings } from '../strings'

export function Employees() {
  const s = strings.employees
  const employees = useEmployees()
  const isDemo = useMe().data?.organization.kind === 'demo'
  const add = useAddEmployee()
  const remove = useDeleteEmployee()
  const [deleting, setDeleting] = useState(false)
  const [deleteId, setDeleteId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [fullName, setFullName] = useState('')
  const [position, setPosition] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (employees.data ?? []).filter((e) => !q || e.fullName.toLowerCase().includes(q))
  }, [employees.data, query])

  const close = () => {
    setOpen(false)
    setFullName('')
    setPosition('')
    setErrors({})
  }

  const closeDelete = () => {
    setDeleting(false)
    setDeleteId('')
    setConfirming(false)
  }

  const toDelete = (employees.data ?? []).find((e) => e.id === deleteId)

  const confirmDelete = () => {
    if (!toDelete) return
    const name = toDelete.fullName
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        closeDelete()
        toast(s.deleted(name))
      },
      onError: (err) => {
        closeDelete()
        toast(err instanceof ApiError ? err.message : strings.errors.generic, 'error')
      },
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setErrors({ fullName: 'Full name is required' })
      return
    }
    add.mutate(
      { fullName: fullName.trim(), position: position.trim() },
      {
        onSuccess: () => {
          close()
          toast(s.added)
        },
        onError: (err) => {
          if (err instanceof ApiError && err.fields) setErrors(err.fields)
          else toast(err instanceof ApiError ? err.message : strings.errors.generic, 'error')
        },
      },
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{s.title}</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => setOpen(true)}>
            <PlusIcon />
            {s.add}
          </Button>
          <Button variant="secondary" onClick={() => setDeleting(true)} disabled={!employees.data?.length}>
            <TrashIcon />
            {s.delete}
          </Button>
        </div>
      </div>

      {employees.isPending && (
        <div className="space-y-3" role="status" aria-label={strings.common.loading}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {employees.isError && <ErrorState message={employees.error.message} onRetry={() => void employees.refetch()} />}

      {employees.isSuccess &&
        (employees.data.length === 0 ? (
          <EmptyState
            title={strings.timer.emptyTitle}
            text={strings.timer.emptyText}
            action={<Button onClick={() => setOpen(true)}>{s.add}</Button>}
          />
        ) : (
          <>
            <div className="relative mb-4">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={s.search}
                aria-label={s.search}
                className={`${inputClass} pl-11`}
              />
            </div>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-neutral">{s.noMatch}</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {filtered.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{e.fullName}</p>
                      {e.position && <p className="truncate text-sm text-neutral">{e.position}</p>}
                    </div>
                    <p className="shrink-0 text-xs text-neutral">{s.addedOn(formatDate(e.createdAt))}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ))}

      <Sheet open={deleting} onClose={closeDelete} title={confirming ? s.deleteConfirmTitle : s.deleteSheetTitle}>
        {confirming && toDelete ? (
          <div className="space-y-4">
            <p>{s.deleteConfirmText(toDelete.fullName)}</p>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={closeDelete} className="flex-1" autoFocus>
                {s.deleteKeep}
              </Button>
              <Button type="button" variant="danger" onClick={confirmDelete} disabled={remove.isPending} className="flex-1">
                {s.deleteConfirm}
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (deleteId) setConfirming(true)
            }}
            className="space-y-4"
          >
            <Field label={s.deleteChoose}>
              {(p) => (
                <select {...p} value={deleteId} onChange={(e) => setDeleteId(e.target.value)} className={inputClass} data-autofocus>
                  <option value="">{s.deleteChoosePlaceholder}</option>
                  {(employees.data ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={closeDelete} className="flex-1">
                {strings.common.cancel}
              </Button>
              <Button type="submit" variant="danger" disabled={!deleteId} className="flex-1">
                {s.deleteContinue}
              </Button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet open={open} onClose={close} title={s.addSheetTitle}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={s.fullName} error={errors.fullName} {...(isDemo ? { hint: strings.privacy.employeeHint } : {})}>
            {(p) => (
              <input
                {...p}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  setErrors({})
                }}
                maxLength={LIMITS.fullName}
                className={inputClass}
                autoComplete="off"
                data-autofocus
              />
            )}
          </Field>
          <Field label={s.position} error={errors.position}>
            {(p) => (
              <input
                {...p}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                maxLength={LIMITS.position}
                className={inputClass}
                autoComplete="off"
              />
            )}
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={close} className="flex-1">
              {strings.common.cancel}
            </Button>
            <Button type="submit" disabled={add.isPending} className="flex-1">
              {s.save}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
