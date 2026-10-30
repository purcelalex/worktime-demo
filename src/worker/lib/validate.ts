import type { Context } from 'hono'
import type { z } from 'zod'
import { AppError } from './errors'

function toFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  return fields
}

function fail(error: z.ZodError): never {
  const fields = toFields(error)
  throw new AppError('VALIDATION_ERROR', Object.values(fields)[0] ?? 'Invalid request', fields)
}

export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Request body must be valid JSON')
  }
  const result = schema.safeParse(raw)
  if (!result.success) fail(result.error)
  return result.data
}

export function parseQuery<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  const result = schema.safeParse(c.req.query())
  if (!result.success) fail(result.error)
  return result.data
}
