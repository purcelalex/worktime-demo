export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'

const STATUS: Record<ErrorCode, 400 | 401 | 404 | 409 | 429 | 500> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

/** An error whose message is safe to show to the client. */
export class AppError extends Error {
  readonly status: 400 | 401 | 404 | 409 | 429 | 500
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.status = STATUS[code]
  }
}
