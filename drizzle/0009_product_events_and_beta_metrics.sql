create table if not exists "product_events" (
  "id" text primary key not null,
  "organization_id" text not null references "organizations"("id") on delete cascade,
  "learner_id" text references "learners"("id") on delete set null,
  "name" text not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create index if not exists "product_events_org_idx"
  on "product_events" ("organization_id", "created_at");
create index if not exists "product_events_name_idx"
  on "product_events" ("name", "created_at");
create index if not exists "product_events_learner_idx"
  on "product_events" ("learner_id", "created_at");

grant select, insert on table public.product_events to authenticated;
alter table public.product_events enable row level security;

create policy product_events_member_select
on public.product_events
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy product_events_member_insert
on public.product_events
for insert to authenticated
with check (private.is_member_of_organization(organization_id));
