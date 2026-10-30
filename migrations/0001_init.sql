-- Phase 1 schema. All timestamps are UTC epoch milliseconds set by the server.

CREATE TABLE organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('demo', 'real')),
  created_at INTEGER NOT NULL
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id),
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE login_attempts (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE employees (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id),
  full_name  TEXT NOT NULL,
  position   TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX employees_org_name ON employees(org_id, lower(full_name));

CREATE TABLE time_entries (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  description TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  stopped_at  INTEGER,
  created_at  INTEGER NOT NULL,
  CHECK (stopped_at IS NULL OR stopped_at >= started_at)
);
-- At most one running timer per employee, enforced by the database.
CREATE UNIQUE INDEX one_running_per_employee ON time_entries(employee_id) WHERE stopped_at IS NULL;
CREATE INDEX time_entries_report ON time_entries(org_id, employee_id, started_at);
