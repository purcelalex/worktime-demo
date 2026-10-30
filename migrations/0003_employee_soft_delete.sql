-- Deleting an employee removes them from the active list but keeps their time
-- records in the history ("soft delete"): is_active = 0 and deleted_at is set.
ALTER TABLE employees ADD COLUMN deleted_at INTEGER;

-- A deleted employee must not block reusing the name, so uniqueness now applies
-- to active employees only.
DROP INDEX employees_org_name;
CREATE UNIQUE INDEX employees_org_name_active ON employees(org_id, lower(full_name)) WHERE is_active = 1;
