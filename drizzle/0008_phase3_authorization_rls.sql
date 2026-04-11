create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_auth_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.uid()::text
$$;

create or replace function private.current_adult_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select au.id
  from public.adult_users au
  where au.auth_user_id = (select auth.uid())::text
  limit 1
$$;

create or replace function private.is_member_of_organization(target_org_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.adult_users au on au.id = m.adult_user_id
    where au.auth_user_id = (select auth.uid())::text
      and m.organization_id = target_org_id
  )
$$;

create or replace function private.can_manage_organization(target_org_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.adult_users au on au.id = m.adult_user_id
    where au.auth_user_id = (select auth.uid())::text
      and m.organization_id = target_org_id
      and m.role::text = any (array['owner', 'admin', 'educator', 'coach', 'manager'])
  )
$$;

create or replace function private.can_access_learner(target_learner_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learners l
    where l.id = target_learner_id
      and private.is_member_of_organization(l.organization_id)
  )
$$;

create or replace function private.can_manage_learner(target_learner_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learners l
    where l.id = target_learner_id
      and private.can_manage_organization(l.organization_id)
  )
$$;

create or replace function private.can_access_framework(target_framework_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.standard_frameworks sf
    where sf.id = target_framework_id
      and (
        sf.organization_id is null
        or private.is_member_of_organization(sf.organization_id)
      )
  )
$$;

create or replace function private.can_manage_framework(target_framework_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.standard_frameworks sf
    where sf.id = target_framework_id
      and sf.organization_id is not null
      and private.can_manage_organization(sf.organization_id)
  )
$$;

create or replace function private.storage_org_id(path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(coalesce(path, ''), '/', 1), '')
$$;

create or replace function private.storage_learner_id(path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(coalesce(path, ''), '/', 2) = 'learners' then nullif(split_part(path, '/', 3), '')
    else null
  end
$$;

grant execute on all functions in schema private to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on table public._hsv2_schema_migrations from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on sequences from authenticated;

alter table public.adult_users enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.organization_platform_settings enable row level security;
alter table public.learners enable row level security;
alter table public.learner_profiles enable row level security;
alter table public.learning_goals enable row level security;
alter table public.goal_mappings enable row level security;
alter table public.curriculum_sources enable row level security;
alter table public.curriculum_phases enable row level security;
alter table public.curriculum_phase_nodes enable row level security;
alter table public.curriculum_progression_state enable row level security;
alter table public.curriculum_assets enable row level security;
alter table public.curriculum_items enable row level security;
alter table public.curriculum_item_standards enable row level security;
alter table public.curriculum_nodes enable row level security;
alter table public.curriculum_skill_prerequisites enable row level security;
alter table public.learner_route_profiles enable row level security;
alter table public.learner_branch_activations enable row level security;
alter table public.learner_skill_states enable row level security;
alter table public.weekly_routes enable row level security;
alter table public.weekly_route_items enable row level security;
alter table public.route_override_events enable row level security;
alter table public.plan_item_curriculum_links enable row level security;
alter table public.plans enable row level security;
alter table public.plan_weeks enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_items enable row level security;
alter table public.plan_item_standards enable row level security;
alter table public.lesson_sessions enable row level security;
alter table public.generated_artifacts enable row level security;
alter table public.interactive_activities enable row level security;
alter table public.activity_standards enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.activity_evidence enable row level security;
alter table public.evidence_records enable row level security;
alter table public.evidence_record_objectives enable row level security;
alter table public.feedback_entries enable row level security;
alter table public.review_queue_items enable row level security;
alter table public.progress_records enable row level security;
alter table public.progress_record_standards enable row level security;
alter table public.observation_notes enable row level security;
alter table public.conversation_threads enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.copilot_actions enable row level security;
alter table public.adaptation_insights enable row level security;
alter table public.recommendations enable row level security;
alter table public.homeschool_attendance_records enable row level security;
alter table public.homeschool_audit_events enable row level security;
alter table public.standard_frameworks enable row level security;
alter table public.standard_nodes enable row level security;

create policy adult_users_self_select
on public.adult_users
for select to authenticated
using (auth_user_id = (select auth.uid())::text);

create policy adult_users_self_update
on public.adult_users
for update to authenticated
using (auth_user_id = (select auth.uid())::text)
with check (auth_user_id = (select auth.uid())::text);

create policy organizations_member_select
on public.organizations
for select to authenticated
using (private.is_member_of_organization(id));

create policy organizations_manage_update
on public.organizations
for update to authenticated
using (private.can_manage_organization(id))
with check (private.can_manage_organization(id));

create policy memberships_visible_to_org_members
on public.memberships
for select to authenticated
using (
  adult_user_id = private.current_adult_user_id()
  or private.is_member_of_organization(organization_id)
);

create policy memberships_manage_insert
on public.memberships
for insert to authenticated
with check (private.can_manage_organization(organization_id));

create policy memberships_manage_update
on public.memberships
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (private.can_manage_organization(organization_id));

create policy memberships_manage_delete
on public.memberships
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy organization_platform_settings_member_select
on public.organization_platform_settings
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy organization_platform_settings_manage_insert
on public.organization_platform_settings
for insert to authenticated
with check (private.can_manage_organization(organization_id));

create policy organization_platform_settings_manage_update
on public.organization_platform_settings
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (private.can_manage_organization(organization_id));

create policy learners_member_select
on public.learners
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy learners_manage_insert
on public.learners
for insert to authenticated
with check (private.can_manage_organization(organization_id));

create policy learners_manage_update
on public.learners
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (private.can_manage_organization(organization_id));

create policy learners_manage_delete
on public.learners
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy learner_profiles_select
on public.learner_profiles
for select to authenticated
using (private.can_access_learner(learner_id));

create policy learner_profiles_manage_insert
on public.learner_profiles
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy learner_profiles_manage_update
on public.learner_profiles
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy learner_profiles_manage_delete
on public.learner_profiles
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy learning_goals_select
on public.learning_goals
for select to authenticated
using (private.can_access_learner(learner_id));

create policy learning_goals_manage_insert
on public.learning_goals
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy learning_goals_manage_update
on public.learning_goals
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy learning_goals_manage_delete
on public.learning_goals
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy goal_mappings_select
on public.goal_mappings
for select to authenticated
using (
  exists (
    select 1
    from public.learning_goals lg
    where lg.id = goal_mappings.learning_goal_id
      and private.can_access_learner(lg.learner_id)
  )
);

create policy goal_mappings_manage_insert
on public.goal_mappings
for insert to authenticated
with check (
  exists (
    select 1
    from public.learning_goals lg
    where lg.id = goal_mappings.learning_goal_id
      and private.can_manage_learner(lg.learner_id)
  )
);

create policy goal_mappings_manage_update
on public.goal_mappings
for update to authenticated
using (
  exists (
    select 1
    from public.learning_goals lg
    where lg.id = goal_mappings.learning_goal_id
      and private.can_manage_learner(lg.learner_id)
  )
)
with check (
  exists (
    select 1
    from public.learning_goals lg
    where lg.id = goal_mappings.learning_goal_id
      and private.can_manage_learner(lg.learner_id)
  )
);

create policy goal_mappings_manage_delete
on public.goal_mappings
for delete to authenticated
using (
  exists (
    select 1
    from public.learning_goals lg
    where lg.id = goal_mappings.learning_goal_id
      and private.can_manage_learner(lg.learner_id)
  )
);

create policy standard_frameworks_select
on public.standard_frameworks
for select to authenticated
using (organization_id is null or private.is_member_of_organization(organization_id));

create policy standard_frameworks_manage_insert
on public.standard_frameworks
for insert to authenticated
with check (organization_id is not null and private.can_manage_organization(organization_id));

create policy standard_frameworks_manage_update
on public.standard_frameworks
for update to authenticated
using (organization_id is not null and private.can_manage_organization(organization_id))
with check (organization_id is not null and private.can_manage_organization(organization_id));

create policy standard_frameworks_manage_delete
on public.standard_frameworks
for delete to authenticated
using (organization_id is not null and private.can_manage_organization(organization_id));

create policy standard_nodes_select
on public.standard_nodes
for select to authenticated
using (private.can_access_framework(framework_id));

create policy standard_nodes_manage_insert
on public.standard_nodes
for insert to authenticated
with check (private.can_manage_framework(framework_id));

create policy standard_nodes_manage_update
on public.standard_nodes
for update to authenticated
using (private.can_manage_framework(framework_id))
with check (private.can_manage_framework(framework_id));

create policy standard_nodes_manage_delete
on public.standard_nodes
for delete to authenticated
using (private.can_manage_framework(framework_id));

create policy curriculum_sources_select
on public.curriculum_sources
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy curriculum_sources_manage_insert
on public.curriculum_sources
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy curriculum_sources_manage_update
on public.curriculum_sources
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy curriculum_sources_manage_delete
on public.curriculum_sources
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy curriculum_phases_select
on public.curriculum_phases
for select to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_phases.source_id
      and private.is_member_of_organization(s.organization_id)
  )
);

create policy curriculum_phases_manage_insert
on public.curriculum_phases
for insert to authenticated
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_phases.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_phases_manage_update
on public.curriculum_phases
for update to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_phases.source_id
      and private.can_manage_organization(s.organization_id)
  )
)
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_phases.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_phases_manage_delete
on public.curriculum_phases
for delete to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_phases.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_phase_nodes_select
on public.curriculum_phase_nodes
for select to authenticated
using (
  exists (
    select 1
    from public.curriculum_phases p
    join public.curriculum_sources s on s.id = p.source_id
    where p.id = curriculum_phase_nodes.phase_id
      and private.is_member_of_organization(s.organization_id)
  )
);

create policy curriculum_phase_nodes_manage_insert
on public.curriculum_phase_nodes
for insert to authenticated
with check (
  exists (
    select 1
    from public.curriculum_phases p
    join public.curriculum_sources s on s.id = p.source_id
    where p.id = curriculum_phase_nodes.phase_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_phase_nodes_manage_update
on public.curriculum_phase_nodes
for update to authenticated
using (
  exists (
    select 1
    from public.curriculum_phases p
    join public.curriculum_sources s on s.id = p.source_id
    where p.id = curriculum_phase_nodes.phase_id
      and private.can_manage_organization(s.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.curriculum_phases p
    join public.curriculum_sources s on s.id = p.source_id
    where p.id = curriculum_phase_nodes.phase_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_phase_nodes_manage_delete
on public.curriculum_phase_nodes
for delete to authenticated
using (
  exists (
    select 1
    from public.curriculum_phases p
    join public.curriculum_sources s on s.id = p.source_id
    where p.id = curriculum_phase_nodes.phase_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_progression_state_select
on public.curriculum_progression_state
for select to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_progression_state.source_id
      and private.is_member_of_organization(s.organization_id)
  )
);

create policy curriculum_progression_state_manage_insert
on public.curriculum_progression_state
for insert to authenticated
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_progression_state.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_progression_state_manage_update
on public.curriculum_progression_state
for update to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_progression_state.source_id
      and private.can_manage_organization(s.organization_id)
  )
)
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_progression_state.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_assets_select
on public.curriculum_assets
for select to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_assets.source_id
      and private.is_member_of_organization(s.organization_id)
  )
);

create policy curriculum_assets_manage_insert
on public.curriculum_assets
for insert to authenticated
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_assets.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_assets_manage_update
on public.curriculum_assets
for update to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_assets.source_id
      and private.can_manage_organization(s.organization_id)
  )
)
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_assets.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_assets_manage_delete
on public.curriculum_assets
for delete to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_assets.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_items_select
on public.curriculum_items
for select to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_items.source_id
      and private.is_member_of_organization(s.organization_id)
  )
);

create policy curriculum_items_manage_insert
on public.curriculum_items
for insert to authenticated
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_items.source_id
      and private.can_manage_organization(s.organization_id)
  )
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy curriculum_items_manage_update
on public.curriculum_items
for update to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_items.source_id
      and private.can_manage_organization(s.organization_id)
  )
)
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_items.source_id
      and private.can_manage_organization(s.organization_id)
  )
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy curriculum_items_manage_delete
on public.curriculum_items
for delete to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_items.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_item_standards_select
on public.curriculum_item_standards
for select to authenticated
using (
  exists (
    select 1
    from public.curriculum_items ci
    join public.curriculum_sources s on s.id = ci.source_id
    where ci.id = curriculum_item_standards.curriculum_item_id
      and private.is_member_of_organization(s.organization_id)
  )
);

create policy curriculum_item_standards_manage_insert
on public.curriculum_item_standards
for insert to authenticated
with check (
  exists (
    select 1
    from public.curriculum_items ci
    join public.curriculum_sources s on s.id = ci.source_id
    where ci.id = curriculum_item_standards.curriculum_item_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_item_standards_manage_update
on public.curriculum_item_standards
for update to authenticated
using (
  exists (
    select 1
    from public.curriculum_items ci
    join public.curriculum_sources s on s.id = ci.source_id
    where ci.id = curriculum_item_standards.curriculum_item_id
      and private.can_manage_organization(s.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.curriculum_items ci
    join public.curriculum_sources s on s.id = ci.source_id
    where ci.id = curriculum_item_standards.curriculum_item_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_item_standards_manage_delete
on public.curriculum_item_standards
for delete to authenticated
using (
  exists (
    select 1
    from public.curriculum_items ci
    join public.curriculum_sources s on s.id = ci.source_id
    where ci.id = curriculum_item_standards.curriculum_item_id
      and private.can_manage_organization(s.organization_id)
  )
);


do $$
begin
  if to_regclass('public.curriculum_objectives') is not null then
    execute 'alter table public.curriculum_objectives enable row level security';

    execute $policy$
      create policy curriculum_objectives_select
      on public.curriculum_objectives
      for select to authenticated
      using (
        exists (
          select 1 from public.curriculum_sources s
          where s.id = curriculum_objectives.source_id
            and private.is_member_of_organization(s.organization_id)
        )
      )
    $policy$;

    execute $policy$
      create policy curriculum_objectives_manage_insert
      on public.curriculum_objectives
      for insert to authenticated
      with check (
        exists (
          select 1 from public.curriculum_sources s
          where s.id = curriculum_objectives.source_id
            and private.can_manage_organization(s.organization_id)
        )
      )
    $policy$;

    execute $policy$
      create policy curriculum_objectives_manage_update
      on public.curriculum_objectives
      for update to authenticated
      using (
        exists (
          select 1 from public.curriculum_sources s
          where s.id = curriculum_objectives.source_id
            and private.can_manage_organization(s.organization_id)
        )
      )
      with check (
        exists (
          select 1 from public.curriculum_sources s
          where s.id = curriculum_objectives.source_id
            and private.can_manage_organization(s.organization_id)
        )
      )
    $policy$;

    execute $policy$
      create policy curriculum_objectives_manage_delete
      on public.curriculum_objectives
      for delete to authenticated
      using (
        exists (
          select 1 from public.curriculum_sources s
          where s.id = curriculum_objectives.source_id
            and private.can_manage_organization(s.organization_id)
        )
      )
    $policy$;
  end if;
end
$$;

create policy curriculum_nodes_select
on public.curriculum_nodes
for select to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_nodes.source_id
      and private.is_member_of_organization(s.organization_id)
  )
);

create policy curriculum_nodes_manage_insert
on public.curriculum_nodes
for insert to authenticated
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_nodes.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_nodes_manage_update
on public.curriculum_nodes
for update to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_nodes.source_id
      and private.can_manage_organization(s.organization_id)
  )
)
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_nodes.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_nodes_manage_delete
on public.curriculum_nodes
for delete to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_nodes.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_skill_prerequisites_select
on public.curriculum_skill_prerequisites
for select to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_skill_prerequisites.source_id
      and private.is_member_of_organization(s.organization_id)
  )
);

create policy curriculum_skill_prerequisites_manage_insert
on public.curriculum_skill_prerequisites
for insert to authenticated
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_skill_prerequisites.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_skill_prerequisites_manage_update
on public.curriculum_skill_prerequisites
for update to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_skill_prerequisites.source_id
      and private.can_manage_organization(s.organization_id)
  )
)
with check (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_skill_prerequisites.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy curriculum_skill_prerequisites_manage_delete
on public.curriculum_skill_prerequisites
for delete to authenticated
using (
  exists (
    select 1 from public.curriculum_sources s
    where s.id = curriculum_skill_prerequisites.source_id
      and private.can_manage_organization(s.organization_id)
  )
);

create policy learner_route_profiles_select
on public.learner_route_profiles
for select to authenticated
using (private.can_access_learner(learner_id));

create policy learner_route_profiles_manage_insert
on public.learner_route_profiles
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy learner_route_profiles_manage_update
on public.learner_route_profiles
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy learner_route_profiles_manage_delete
on public.learner_route_profiles
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy learner_branch_activations_select
on public.learner_branch_activations
for select to authenticated
using (private.can_access_learner(learner_id));

create policy learner_branch_activations_manage_insert
on public.learner_branch_activations
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy learner_branch_activations_manage_update
on public.learner_branch_activations
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy learner_branch_activations_manage_delete
on public.learner_branch_activations
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy learner_skill_states_select
on public.learner_skill_states
for select to authenticated
using (private.can_access_learner(learner_id));

create policy learner_skill_states_manage_insert
on public.learner_skill_states
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy learner_skill_states_manage_update
on public.learner_skill_states
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy learner_skill_states_manage_delete
on public.learner_skill_states
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy weekly_routes_select
on public.weekly_routes
for select to authenticated
using (private.can_access_learner(learner_id));

create policy weekly_routes_manage_insert
on public.weekly_routes
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy weekly_routes_manage_update
on public.weekly_routes
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy weekly_routes_manage_delete
on public.weekly_routes
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy weekly_route_items_select
on public.weekly_route_items
for select to authenticated
using (private.can_access_learner(learner_id));

create policy weekly_route_items_manage_insert
on public.weekly_route_items
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy weekly_route_items_manage_update
on public.weekly_route_items
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy weekly_route_items_manage_delete
on public.weekly_route_items
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy route_override_events_select
on public.route_override_events
for select to authenticated
using (private.can_access_learner(learner_id));

create policy route_override_events_manage_insert
on public.route_override_events
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy route_override_events_manage_update
on public.route_override_events
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy route_override_events_manage_delete
on public.route_override_events
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy plan_item_curriculum_links_select
on public.plan_item_curriculum_links
for select to authenticated
using (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_curriculum_links.plan_item_id
      and private.is_member_of_organization(p.organization_id)
  )
);

create policy plan_item_curriculum_links_manage_insert
on public.plan_item_curriculum_links
for insert to authenticated
with check (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_curriculum_links.plan_item_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_item_curriculum_links_manage_update
on public.plan_item_curriculum_links
for update to authenticated
using (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_curriculum_links.plan_item_id
      and private.can_manage_organization(p.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_curriculum_links.plan_item_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_item_curriculum_links_manage_delete
on public.plan_item_curriculum_links
for delete to authenticated
using (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_curriculum_links.plan_item_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plans_select
on public.plans
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy plans_manage_insert
on public.plans
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy plans_manage_update
on public.plans
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy plans_manage_delete
on public.plans
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy plan_weeks_select
on public.plan_weeks
for select to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_weeks.plan_id
      and private.is_member_of_organization(p.organization_id)
  )
);

create policy plan_weeks_manage_insert
on public.plan_weeks
for insert to authenticated
with check (
  exists (
    select 1 from public.plans p
    where p.id = plan_weeks.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_weeks_manage_update
on public.plan_weeks
for update to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_weeks.plan_id
      and private.can_manage_organization(p.organization_id)
  )
)
with check (
  exists (
    select 1 from public.plans p
    where p.id = plan_weeks.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_weeks_manage_delete
on public.plan_weeks
for delete to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_weeks.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_days_select
on public.plan_days
for select to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id
      and private.is_member_of_organization(p.organization_id)
  )
);

create policy plan_days_manage_insert
on public.plan_days
for insert to authenticated
with check (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_days_manage_update
on public.plan_days
for update to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id
      and private.can_manage_organization(p.organization_id)
  )
)
with check (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_days_manage_delete
on public.plan_days
for delete to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_items_select
on public.plan_items
for select to authenticated
using (
  exists (
    select 1
    from public.plan_days pd
    join public.plans p on p.id = pd.plan_id
    where pd.id = plan_items.plan_day_id
      and private.is_member_of_organization(p.organization_id)
  )
);

create policy plan_items_manage_insert
on public.plan_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.plan_days pd
    join public.plans p on p.id = pd.plan_id
    where pd.id = plan_items.plan_day_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_items_manage_update
on public.plan_items
for update to authenticated
using (
  exists (
    select 1
    from public.plan_days pd
    join public.plans p on p.id = pd.plan_id
    where pd.id = plan_items.plan_day_id
      and private.can_manage_organization(p.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.plan_days pd
    join public.plans p on p.id = pd.plan_id
    where pd.id = plan_items.plan_day_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_items_manage_delete
on public.plan_items
for delete to authenticated
using (
  exists (
    select 1
    from public.plan_days pd
    join public.plans p on p.id = pd.plan_id
    where pd.id = plan_items.plan_day_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_item_standards_select
on public.plan_item_standards
for select to authenticated
using (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_standards.plan_item_id
      and private.is_member_of_organization(p.organization_id)
  )
);

create policy plan_item_standards_manage_insert
on public.plan_item_standards
for insert to authenticated
with check (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_standards.plan_item_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_item_standards_manage_update
on public.plan_item_standards
for update to authenticated
using (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_standards.plan_item_id
      and private.can_manage_organization(p.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_standards.plan_item_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy plan_item_standards_manage_delete
on public.plan_item_standards
for delete to authenticated
using (
  exists (
    select 1
    from public.plan_items pi
    join public.plan_days pd on pd.id = pi.plan_day_id
    join public.plans p on p.id = pd.plan_id
    where pi.id = plan_item_standards.plan_item_id
      and private.can_manage_organization(p.organization_id)
  )
);

create policy lesson_sessions_select
on public.lesson_sessions
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy lesson_sessions_manage_insert
on public.lesson_sessions
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy lesson_sessions_manage_update
on public.lesson_sessions
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy lesson_sessions_manage_delete
on public.lesson_sessions
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy generated_artifacts_select
on public.generated_artifacts
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy generated_artifacts_manage_insert
on public.generated_artifacts
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy generated_artifacts_manage_update
on public.generated_artifacts
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy generated_artifacts_manage_delete
on public.generated_artifacts
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy interactive_activities_select
on public.interactive_activities
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy interactive_activities_manage_insert
on public.interactive_activities
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy interactive_activities_manage_update
on public.interactive_activities
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy interactive_activities_manage_delete
on public.interactive_activities
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy activity_standards_select
on public.activity_standards
for select to authenticated
using (
  exists (
    select 1 from public.interactive_activities ia
    where ia.id = activity_standards.activity_id
      and private.is_member_of_organization(ia.organization_id)
  )
);

create policy activity_standards_manage_insert
on public.activity_standards
for insert to authenticated
with check (
  exists (
    select 1 from public.interactive_activities ia
    where ia.id = activity_standards.activity_id
      and private.can_manage_organization(ia.organization_id)
  )
);

create policy activity_standards_manage_update
on public.activity_standards
for update to authenticated
using (
  exists (
    select 1 from public.interactive_activities ia
    where ia.id = activity_standards.activity_id
      and private.can_manage_organization(ia.organization_id)
  )
)
with check (
  exists (
    select 1 from public.interactive_activities ia
    where ia.id = activity_standards.activity_id
      and private.can_manage_organization(ia.organization_id)
  )
);

create policy activity_standards_manage_delete
on public.activity_standards
for delete to authenticated
using (
  exists (
    select 1 from public.interactive_activities ia
    where ia.id = activity_standards.activity_id
      and private.can_manage_organization(ia.organization_id)
  )
);

create policy activity_attempts_select
on public.activity_attempts
for select to authenticated
using (private.can_access_learner(learner_id));

create policy activity_attempts_manage_insert
on public.activity_attempts
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy activity_attempts_manage_update
on public.activity_attempts
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy activity_attempts_manage_delete
on public.activity_attempts
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy activity_evidence_select
on public.activity_evidence
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy activity_evidence_manage_insert
on public.activity_evidence
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy activity_evidence_manage_update
on public.activity_evidence
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy activity_evidence_manage_delete
on public.activity_evidence
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy evidence_records_select
on public.evidence_records
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy evidence_records_manage_insert
on public.evidence_records
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy evidence_records_manage_update
on public.evidence_records
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy evidence_records_manage_delete
on public.evidence_records
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy evidence_record_objectives_select
on public.evidence_record_objectives
for select to authenticated
using (
  exists (
    select 1 from public.evidence_records er
    where er.id = evidence_record_objectives.evidence_record_id
      and private.is_member_of_organization(er.organization_id)
  )
);

create policy evidence_record_objectives_manage_insert
on public.evidence_record_objectives
for insert to authenticated
with check (
  exists (
    select 1 from public.evidence_records er
    where er.id = evidence_record_objectives.evidence_record_id
      and private.can_manage_organization(er.organization_id)
  )
);

create policy evidence_record_objectives_manage_update
on public.evidence_record_objectives
for update to authenticated
using (
  exists (
    select 1 from public.evidence_records er
    where er.id = evidence_record_objectives.evidence_record_id
      and private.can_manage_organization(er.organization_id)
  )
)
with check (
  exists (
    select 1 from public.evidence_records er
    where er.id = evidence_record_objectives.evidence_record_id
      and private.can_manage_organization(er.organization_id)
  )
);

create policy evidence_record_objectives_manage_delete
on public.evidence_record_objectives
for delete to authenticated
using (
  exists (
    select 1 from public.evidence_records er
    where er.id = evidence_record_objectives.evidence_record_id
      and private.can_manage_organization(er.organization_id)
  )
);

create policy feedback_entries_select
on public.feedback_entries
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy feedback_entries_manage_insert
on public.feedback_entries
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy feedback_entries_manage_update
on public.feedback_entries
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy feedback_entries_manage_delete
on public.feedback_entries
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy review_queue_items_select
on public.review_queue_items
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy review_queue_items_manage_insert
on public.review_queue_items
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy review_queue_items_manage_update
on public.review_queue_items
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy review_queue_items_manage_delete
on public.review_queue_items
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy progress_records_select
on public.progress_records
for select to authenticated
using (private.can_access_learner(learner_id));

create policy progress_records_manage_insert
on public.progress_records
for insert to authenticated
with check (private.can_manage_learner(learner_id));

create policy progress_records_manage_update
on public.progress_records
for update to authenticated
using (private.can_manage_learner(learner_id))
with check (private.can_manage_learner(learner_id));

create policy progress_records_manage_delete
on public.progress_records
for delete to authenticated
using (private.can_manage_learner(learner_id));

create policy progress_record_standards_select
on public.progress_record_standards
for select to authenticated
using (
  exists (
    select 1 from public.progress_records pr
    where pr.id = progress_record_standards.progress_record_id
      and private.can_access_learner(pr.learner_id)
  )
);

create policy progress_record_standards_manage_insert
on public.progress_record_standards
for insert to authenticated
with check (
  exists (
    select 1 from public.progress_records pr
    where pr.id = progress_record_standards.progress_record_id
      and private.can_manage_learner(pr.learner_id)
  )
);

create policy progress_record_standards_manage_update
on public.progress_record_standards
for update to authenticated
using (
  exists (
    select 1 from public.progress_records pr
    where pr.id = progress_record_standards.progress_record_id
      and private.can_manage_learner(pr.learner_id)
  )
)
with check (
  exists (
    select 1 from public.progress_records pr
    where pr.id = progress_record_standards.progress_record_id
      and private.can_manage_learner(pr.learner_id)
  )
);

create policy progress_record_standards_manage_delete
on public.progress_record_standards
for delete to authenticated
using (
  exists (
    select 1 from public.progress_records pr
    where pr.id = progress_record_standards.progress_record_id
      and private.can_manage_learner(pr.learner_id)
  )
);

create policy observation_notes_select
on public.observation_notes
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy observation_notes_manage_insert
on public.observation_notes
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy observation_notes_manage_update
on public.observation_notes
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy observation_notes_manage_delete
on public.observation_notes
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy conversation_threads_select
on public.conversation_threads
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy conversation_threads_manage_insert
on public.conversation_threads
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy conversation_threads_manage_update
on public.conversation_threads
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy conversation_threads_manage_delete
on public.conversation_threads
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy conversation_messages_select
on public.conversation_messages
for select to authenticated
using (
  exists (
    select 1 from public.conversation_threads t
    where t.id = conversation_messages.thread_id
      and private.is_member_of_organization(t.organization_id)
  )
);

create policy conversation_messages_manage_insert
on public.conversation_messages
for insert to authenticated
with check (
  exists (
    select 1 from public.conversation_threads t
    where t.id = conversation_messages.thread_id
      and private.can_manage_organization(t.organization_id)
  )
);

create policy conversation_messages_manage_update
on public.conversation_messages
for update to authenticated
using (
  exists (
    select 1 from public.conversation_threads t
    where t.id = conversation_messages.thread_id
      and private.can_manage_organization(t.organization_id)
  )
)
with check (
  exists (
    select 1 from public.conversation_threads t
    where t.id = conversation_messages.thread_id
      and private.can_manage_organization(t.organization_id)
  )
);

create policy conversation_messages_manage_delete
on public.conversation_messages
for delete to authenticated
using (
  exists (
    select 1 from public.conversation_threads t
    where t.id = conversation_messages.thread_id
      and private.can_manage_organization(t.organization_id)
  )
);

create policy copilot_actions_select
on public.copilot_actions
for select to authenticated
using (
  exists (
    select 1 from public.conversation_threads t
    where t.id = copilot_actions.thread_id
      and private.is_member_of_organization(t.organization_id)
  )
);

create policy copilot_actions_manage_insert
on public.copilot_actions
for insert to authenticated
with check (
  exists (
    select 1 from public.conversation_threads t
    where t.id = copilot_actions.thread_id
      and private.can_manage_organization(t.organization_id)
  )
);

create policy copilot_actions_manage_update
on public.copilot_actions
for update to authenticated
using (
  exists (
    select 1 from public.conversation_threads t
    where t.id = copilot_actions.thread_id
      and private.can_manage_organization(t.organization_id)
  )
)
with check (
  exists (
    select 1 from public.conversation_threads t
    where t.id = copilot_actions.thread_id
      and private.can_manage_organization(t.organization_id)
  )
);

create policy copilot_actions_manage_delete
on public.copilot_actions
for delete to authenticated
using (
  exists (
    select 1 from public.conversation_threads t
    where t.id = copilot_actions.thread_id
      and private.can_manage_organization(t.organization_id)
  )
);

create policy adaptation_insights_select
on public.adaptation_insights
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy adaptation_insights_manage_insert
on public.adaptation_insights
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy adaptation_insights_manage_update
on public.adaptation_insights
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy adaptation_insights_manage_delete
on public.adaptation_insights
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy recommendations_select
on public.recommendations
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy recommendations_manage_insert
on public.recommendations
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy recommendations_manage_update
on public.recommendations
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy recommendations_manage_delete
on public.recommendations
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy homeschool_attendance_records_select
on public.homeschool_attendance_records
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy homeschool_attendance_records_manage_insert
on public.homeschool_attendance_records
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy homeschool_attendance_records_manage_update
on public.homeschool_attendance_records
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and private.can_manage_learner(learner_id)
);

create policy homeschool_attendance_records_manage_delete
on public.homeschool_attendance_records
for delete to authenticated
using (private.can_manage_organization(organization_id));

create policy homeschool_audit_events_select
on public.homeschool_audit_events
for select to authenticated
using (private.is_member_of_organization(organization_id));

create policy homeschool_audit_events_manage_insert
on public.homeschool_audit_events
for insert to authenticated
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy homeschool_audit_events_manage_update
on public.homeschool_audit_events
for update to authenticated
using (private.can_manage_organization(organization_id))
with check (
  private.can_manage_organization(organization_id)
  and (learner_id is null or private.can_manage_learner(learner_id))
);

create policy homeschool_audit_events_manage_delete
on public.homeschool_audit_events
for delete to authenticated
using (private.can_manage_organization(organization_id));

insert into storage.buckets (id, name, public)
values
  ('curriculum-assets', 'curriculum-assets', false),
  ('generated-artifacts', 'generated-artifacts', false),
  ('learner-uploads', 'learner-uploads', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

create policy storage_curriculum_assets_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'curriculum-assets'
  and private.is_member_of_organization(private.storage_org_id(name))
);

create policy storage_curriculum_assets_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'curriculum-assets'
  and private.can_manage_organization(private.storage_org_id(name))
);

create policy storage_curriculum_assets_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'curriculum-assets'
  and private.can_manage_organization(private.storage_org_id(name))
)
with check (
  bucket_id = 'curriculum-assets'
  and private.can_manage_organization(private.storage_org_id(name))
);

create policy storage_curriculum_assets_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'curriculum-assets'
  and private.can_manage_organization(private.storage_org_id(name))
);

create policy storage_generated_artifacts_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'generated-artifacts'
  and private.is_member_of_organization(private.storage_org_id(name))
);

create policy storage_generated_artifacts_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'generated-artifacts'
  and private.can_manage_organization(private.storage_org_id(name))
);

create policy storage_generated_artifacts_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'generated-artifacts'
  and private.can_manage_organization(private.storage_org_id(name))
)
with check (
  bucket_id = 'generated-artifacts'
  and private.can_manage_organization(private.storage_org_id(name))
);

create policy storage_generated_artifacts_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'generated-artifacts'
  and private.can_manage_organization(private.storage_org_id(name))
);

create policy storage_learner_uploads_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'learner-uploads'
  and private.can_access_learner(private.storage_learner_id(name))
);

create policy storage_learner_uploads_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'learner-uploads'
  and private.can_manage_organization(private.storage_org_id(name))
  and private.can_manage_learner(private.storage_learner_id(name))
);

create policy storage_learner_uploads_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'learner-uploads'
  and private.can_manage_organization(private.storage_org_id(name))
  and private.can_manage_learner(private.storage_learner_id(name))
)
with check (
  bucket_id = 'learner-uploads'
  and private.can_manage_organization(private.storage_org_id(name))
  and private.can_manage_learner(private.storage_learner_id(name))
);

create policy storage_learner_uploads_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'learner-uploads'
  and private.can_manage_organization(private.storage_org_id(name))
  and private.can_manage_learner(private.storage_learner_id(name))
);
