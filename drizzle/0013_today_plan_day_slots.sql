DO $$ BEGIN
 CREATE TYPE "public"."plan_day_slot_origin" AS ENUM('manual', 'system_generated', 'template', 'carryover');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."plan_day_slot_status" AS ENUM('planned', 'in_progress', 'completed', 'skipped', 'canceled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."plan_day_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"plan_day_id" text NOT NULL,
	"slot_index" integer NOT NULL,
	"title" text NOT NULL,
	"origin" "public"."plan_day_slot_origin" DEFAULT 'manual' NOT NULL,
	"status" "public"."plan_day_slot_status" DEFAULT 'planned' NOT NULL,
	"planned_minutes" integer,
	"starts_at_minutes" integer,
	"ends_at_minutes" integer,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."plan_day_slots" ADD CONSTRAINT "plan_day_slots_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."plan_day_slots" ADD CONSTRAINT "plan_day_slots_plan_day_id_plan_days_id_fk" FOREIGN KEY ("plan_day_id") REFERENCES "public"."plan_days"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."plan_items" ADD COLUMN IF NOT EXISTS "plan_day_slot_id" text;
--> statement-breakpoint
ALTER TABLE "public"."lesson_sessions" ADD COLUMN IF NOT EXISTS "plan_day_slot_id" text;
--> statement-breakpoint
ALTER TABLE "public"."weekly_route_items" ADD COLUMN IF NOT EXISTS "scheduled_slot_index" integer;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."plan_items" ADD CONSTRAINT "plan_items_plan_day_slot_id_plan_day_slots_id_fk" FOREIGN KEY ("plan_day_slot_id") REFERENCES "public"."plan_day_slots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."lesson_sessions" ADD CONSTRAINT "lesson_sessions_plan_day_slot_id_plan_day_slots_id_fk" FOREIGN KEY ("plan_day_slot_id") REFERENCES "public"."plan_day_slots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_day_slots_plan_idx" ON "public"."plan_day_slots" USING btree ("plan_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_day_slots_plan_day_idx" ON "public"."plan_day_slots" USING btree ("plan_day_id","slot_index","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plan_day_slots_day_slot_idx" ON "public"."plan_day_slots" USING btree ("plan_day_id","slot_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_items_plan_day_slot_idx" ON "public"."plan_items" USING btree ("plan_day_slot_id","ordering","created_at");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."plan_day_slots" TO "authenticated";
