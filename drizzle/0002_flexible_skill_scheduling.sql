DROP INDEX IF EXISTS "weekly_route_items_route_skill_idx";
CREATE UNIQUE INDEX "weekly_route_items_route_skill_date_idx" ON "weekly_route_items" ("weekly_route_id", "skill_node_id", "scheduled_date");
