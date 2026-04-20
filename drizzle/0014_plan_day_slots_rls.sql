alter table public.plan_day_slots enable row level security;

drop policy if exists plan_day_slots_select on public.plan_day_slots;
create policy plan_day_slots_select
on public.plan_day_slots
for select to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = plan_day_slots.plan_id
      and private.is_member_of_organization(p.organization_id)
  )
);

drop policy if exists plan_day_slots_manage_insert on public.plan_day_slots;
create policy plan_day_slots_manage_insert
on public.plan_day_slots
for insert to authenticated
with check (
  exists (
    select 1
    from public.plans p
    where p.id = plan_day_slots.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);

drop policy if exists plan_day_slots_manage_update on public.plan_day_slots;
create policy plan_day_slots_manage_update
on public.plan_day_slots
for update to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = plan_day_slots.plan_id
      and private.can_manage_organization(p.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.plans p
    where p.id = plan_day_slots.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);

drop policy if exists plan_day_slots_manage_delete on public.plan_day_slots;
create policy plan_day_slots_manage_delete
on public.plan_day_slots
for delete to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = plan_day_slots.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);
