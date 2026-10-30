// Typed mirror of migrations/*.sql, used only to build queries.
// The migrations are the source of truth (they also hold the expression index
// on lower(full_name) and the partial unique index on running timers).
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['demo', 'real'] }).notNull(),
  createdAt: integer('created_at').notNull(),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'manager', 'employee'] }).notNull(),
  isActive: integer('is_active').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  fullName: text('full_name').notNull(),
  position: text('position'),
  isActive: integer('is_active').notNull(),
  createdAt: integer('created_at').notNull(),
  // Set when the employee is deleted from the list; their history stays.
  deletedAt: integer('deleted_at'),
})

export const timeEntries = sqliteTable('time_entries', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  employeeId: text('employee_id').notNull(),
  description: text('description').notNull(),
  startedAt: integer('started_at').notNull(),
  stoppedAt: integer('stopped_at'),
  createdAt: integer('created_at').notNull(),
  // NULL while running; see migrations/0002_pause_resume.sql.
  endReason: text('end_reason', { enum: ['stopped', 'paused', 'resumed'] }),
  // Time already worked on this task before this segment started (after a pause).
  carriedMs: integer('carried_ms').notNull().default(0),
})
