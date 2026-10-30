/**
 * Limits shared by the API and the UI. Kept in its own file with no imports so
 * the browser bundle never has to include the validation library (zod).
 */
export const LIMITS = {
  fullName: 100,
  position: 100,
  description: 200,
  maxPeriodMs: 366 * 24 * 60 * 60 * 1000,
  minTimestamp: Date.UTC(2000, 0, 1),
  maxTimestamp: Date.UTC(2100, 0, 1),
  demoEmployeeCap: 50,
} as const
