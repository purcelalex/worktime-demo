-- Pause and resume.
-- A work period is a "segment" (one time_entries row). Pausing closes the
-- segment and marks it 'paused'; resuming starts a new segment that carries the
-- time already worked on the task (carried_ms), so the clock continues instead
-- of restarting from zero.
--
-- end_reason: NULL while running, then
--   'stopped' = finished for good,
--   'paused'  = closed by a pause and still waiting to be resumed or stopped,
--   'resumed' = was paused, then resumed (history).
ALTER TABLE time_entries ADD COLUMN end_reason TEXT
  CHECK (end_reason IS NULL OR end_reason IN ('stopped', 'paused', 'resumed'));
ALTER TABLE time_entries ADD COLUMN carried_ms INTEGER NOT NULL DEFAULT 0;

-- Every entry that was already finished is a plain stop.
UPDATE time_entries SET end_reason = 'stopped' WHERE stopped_at IS NOT NULL;

-- At most one paused timer per employee, enforced by the database.
CREATE UNIQUE INDEX one_paused_per_employee ON time_entries(employee_id) WHERE end_reason = 'paused';
