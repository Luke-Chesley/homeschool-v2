DO $$ BEGIN
 CREATE TYPE "public"."intake_source_package_modality" AS ENUM('text', 'outline', 'photo', 'image', 'pdf', 'file');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."intake_source_package_status" AS ENUM('draft', 'ready', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."intake_source_asset_extraction_status" AS ENUM('pending', 'ready', 'requires_review', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intake_source_packages" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL references "organizations"("id") on delete cascade,
  "learner_id" text references "learners"("id") on delete set null,
  "title" text NOT NULL,
  "modality" "intake_source_package_modality" NOT NULL,
  "status" "intake_source_package_status" DEFAULT 'draft' NOT NULL,
  "normalized_text" text DEFAULT '' NOT NULL,
  "source_fingerprint" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intake_source_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "package_id" text NOT NULL references "intake_source_packages"("id") on delete cascade,
  "storage_bucket" text NOT NULL,
  "storage_path" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" integer,
  "extraction_status" "intake_source_asset_extraction_status" DEFAULT 'pending' NOT NULL,
  "extracted_text" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_source_packages_org_idx"
  ON "intake_source_packages" ("organization_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_source_packages_learner_idx"
  ON "intake_source_packages" ("learner_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_source_assets_package_idx"
  ON "intake_source_assets" ("package_id");
--> statement-breakpoint

alter table public.intake_source_packages enable row level security;
alter table public.intake_source_assets enable row level security;

create policy intake_source_packages_select
on public.intake_source_packages
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy intake_source_packages_manage_insert
on public.intake_source_packages
for insert to authenticated
with check (private.is_member_of_organization(organization_id));

create policy intake_source_packages_manage_update
on public.intake_source_packages
for update to authenticated
using (private.is_member_of_organization(organization_id))
with check (private.is_member_of_organization(organization_id));

create policy intake_source_packages_manage_delete
on public.intake_source_packages
for delete to authenticated
using (private.is_member_of_organization(organization_id));

create policy intake_source_assets_select
on public.intake_source_assets
for select to authenticated
using (
  exists (
    select 1
    from public.intake_source_packages pkg
    where pkg.id = package_id
      and private.is_member_of_organization(pkg.organization_id)
  )
);

create policy intake_source_assets_manage_insert
on public.intake_source_assets
for insert to authenticated
with check (
  exists (
    select 1
    from public.intake_source_packages pkg
    where pkg.id = package_id
      and private.is_member_of_organization(pkg.organization_id)
  )
);

create policy intake_source_assets_manage_update
on public.intake_source_assets
for update to authenticated
using (
  exists (
    select 1
    from public.intake_source_packages pkg
    where pkg.id = package_id
      and private.is_member_of_organization(pkg.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.intake_source_packages pkg
    where pkg.id = package_id
      and private.is_member_of_organization(pkg.organization_id)
  )
);

create policy intake_source_assets_manage_delete
on public.intake_source_assets
for delete to authenticated
using (
  exists (
    select 1
    from public.intake_source_packages pkg
    where pkg.id = package_id
      and private.is_member_of_organization(pkg.organization_id)
  )
);
