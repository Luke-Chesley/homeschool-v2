alter table public.compliance_programs enable row level security;
alter table public.compliance_progress_snapshots enable row level security;
alter table public.compliance_evaluation_records enable row level security;
alter table public.compliance_tasks enable row level security;
alter table public.compliance_report_drafts enable row level security;

drop policy if exists compliance_programs_select on public.compliance_programs;
create policy compliance_programs_select
on public.compliance_programs
for select to authenticated
using (private.is_member_of_organization(organization_id));

drop policy if exists compliance_programs_manage_insert on public.compliance_programs;
create policy compliance_programs_manage_insert
on public.compliance_programs
for insert to authenticated
with check (private.can_manage_organization(organization_id));

drop policy if exists compliance_programs_manage_update on public.compliance_programs;
create policy compliance_programs_manage_update
on public.compliance_programs
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (private.can_manage_organization(organization_id));

drop policy if exists compliance_programs_manage_delete on public.compliance_programs;
create policy compliance_programs_manage_delete
on public.compliance_programs
for delete to authenticated
using (private.can_manage_organization(organization_id));

drop policy if exists compliance_progress_snapshots_select on public.compliance_progress_snapshots;
create policy compliance_progress_snapshots_select
on public.compliance_progress_snapshots
for select to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_progress_snapshots.compliance_program_id
      and private.is_member_of_organization(cp.organization_id)
  )
);

drop policy if exists compliance_progress_snapshots_manage_insert on public.compliance_progress_snapshots;
create policy compliance_progress_snapshots_manage_insert
on public.compliance_progress_snapshots
for insert to authenticated
with check (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_progress_snapshots.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_progress_snapshots_manage_update on public.compliance_progress_snapshots;
create policy compliance_progress_snapshots_manage_update
on public.compliance_progress_snapshots
for update to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_progress_snapshots.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_progress_snapshots.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_progress_snapshots_manage_delete on public.compliance_progress_snapshots;
create policy compliance_progress_snapshots_manage_delete
on public.compliance_progress_snapshots
for delete to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_progress_snapshots.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_evaluation_records_select on public.compliance_evaluation_records;
create policy compliance_evaluation_records_select
on public.compliance_evaluation_records
for select to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_evaluation_records.compliance_program_id
      and private.is_member_of_organization(cp.organization_id)
  )
);

drop policy if exists compliance_evaluation_records_manage_insert on public.compliance_evaluation_records;
create policy compliance_evaluation_records_manage_insert
on public.compliance_evaluation_records
for insert to authenticated
with check (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_evaluation_records.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_evaluation_records_manage_update on public.compliance_evaluation_records;
create policy compliance_evaluation_records_manage_update
on public.compliance_evaluation_records
for update to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_evaluation_records.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_evaluation_records.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_evaluation_records_manage_delete on public.compliance_evaluation_records;
create policy compliance_evaluation_records_manage_delete
on public.compliance_evaluation_records
for delete to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_evaluation_records.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_tasks_select on public.compliance_tasks;
create policy compliance_tasks_select
on public.compliance_tasks
for select to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_tasks.compliance_program_id
      and private.is_member_of_organization(cp.organization_id)
  )
);

drop policy if exists compliance_tasks_manage_insert on public.compliance_tasks;
create policy compliance_tasks_manage_insert
on public.compliance_tasks
for insert to authenticated
with check (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_tasks.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_tasks_manage_update on public.compliance_tasks;
create policy compliance_tasks_manage_update
on public.compliance_tasks
for update to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_tasks.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_tasks.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_tasks_manage_delete on public.compliance_tasks;
create policy compliance_tasks_manage_delete
on public.compliance_tasks
for delete to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_tasks.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_report_drafts_select on public.compliance_report_drafts;
create policy compliance_report_drafts_select
on public.compliance_report_drafts
for select to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_report_drafts.compliance_program_id
      and private.is_member_of_organization(cp.organization_id)
  )
);

drop policy if exists compliance_report_drafts_manage_insert on public.compliance_report_drafts;
create policy compliance_report_drafts_manage_insert
on public.compliance_report_drafts
for insert to authenticated
with check (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_report_drafts.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_report_drafts_manage_update on public.compliance_report_drafts;
create policy compliance_report_drafts_manage_update
on public.compliance_report_drafts
for update to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_report_drafts.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_report_drafts.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);

drop policy if exists compliance_report_drafts_manage_delete on public.compliance_report_drafts;
create policy compliance_report_drafts_manage_delete
on public.compliance_report_drafts
for delete to authenticated
using (
  exists (
    select 1
    from public.compliance_programs cp
    where cp.id = compliance_report_drafts.compliance_program_id
      and private.can_manage_organization(cp.organization_id)
  )
);
