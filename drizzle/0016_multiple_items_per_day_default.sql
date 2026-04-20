ALTER TABLE "public"."learner_route_profiles"
ALTER COLUMN "target_items_per_day" SET DEFAULT 2;
--> statement-breakpoint
UPDATE "public"."learner_route_profiles"
SET
  "target_items_per_day" = 2,
  "updated_at" = now()
WHERE "target_items_per_day" = 1;
--> statement-breakpoint
UPDATE "public"."weekly_route_items"
SET
  "scheduled_slot_index" = 1,
  "updated_at" = now()
WHERE "scheduled_date" IS NOT NULL
  AND "scheduled_slot_index" IS NULL;
