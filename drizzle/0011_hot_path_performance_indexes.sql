CREATE INDEX IF NOT EXISTS "plans_org_learner_updated_idx"
ON "plans" ("organization_id", "learner_id", "updated_at", "created_at");

CREATE INDEX IF NOT EXISTS "plan_items_plan_idx"
ON "plan_items" ("plan_id");

CREATE INDEX IF NOT EXISTS "plan_items_plan_day_order_idx"
ON "plan_items" ("plan_day_id", "ordering", "created_at");

CREATE INDEX IF NOT EXISTS "weekly_route_items_route_position_idx"
ON "weekly_route_items" ("weekly_route_id", "current_position", "created_at");

CREATE INDEX IF NOT EXISTS "activity_attempts_activity_learner_attempt_idx"
ON "activity_attempts" ("activity_id", "learner_id", "attempt_number", "created_at");

CREATE INDEX IF NOT EXISTS "activity_attempts_learner_session_status_attempt_idx"
ON "activity_attempts" ("learner_id", "lesson_session_id", "status", "attempt_number", "created_at");

CREATE INDEX IF NOT EXISTS "progress_records_attempt_idx"
ON "progress_records" ("activity_attempt_id");

CREATE INDEX IF NOT EXISTS "progress_records_learner_created_idx"
ON "progress_records" ("learner_id", "created_at");

CREATE INDEX IF NOT EXISTS "progress_records_session_plan_item_created_idx"
ON "progress_records" ("lesson_session_id", "plan_item_id", "created_at");
