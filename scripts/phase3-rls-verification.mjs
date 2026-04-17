import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed sign-in for ${email}: ${error.message}`);
  }

  return client;
}

async function expectQueryIds(label, queryPromise, expectedIds) {
  const { data, error } = await queryPromise;
  if (error) {
    throw new Error(`${label} failed: ${error.message}`);
  }

  const ids = (data ?? []).map((row) => row.id).sort();
  const expected = [...expectedIds].sort();
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error(`${label} returned ${JSON.stringify(ids)}; expected ${JSON.stringify(expected)}`);
  }
}

async function expectError(label, promiseFactory) {
  const result = await promiseFactory();
  if (!result.error) {
    throw new Error(`${label} unexpectedly succeeded`);
  }
}

const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const databaseUrl = requireEnv('DATABASE_URL');

const adminClient = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const sql = postgres(databaseUrl, { prepare: false });

const runId = `phase3_${Date.now()}`;
const password = 'LocalPass123!';

const orgA = `org_${runId}_a`;
const orgB = `org_${runId}_b`;
const adultA = `adult_${runId}_a`;
const adultB = `adult_${runId}_b`;
const membershipA = `mbr_${runId}_a`;
const membershipB = `mbr_${runId}_b`;
const learnerA = `learner_${runId}_a`;
const learnerB = `learner_${runId}_b`;
const recommendationA = `recommendation_${runId}_a`;
const recommendationB = `recommendation_${runId}_b`;
const complianceProgramA = `program_${runId}_a`;
const complianceProgramB = `program_${runId}_b`;
const complianceTaskA = `ctask_${runId}_a`;
const complianceTaskB = `ctask_${runId}_b`;

const emailA = `${runId}.parent.a@example.com`;
const emailB = `${runId}.parent.b@example.com`;

let authUserA;
let authUserB;

try {
  const createdA = await adminClient.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (createdA.error || !createdA.data.user) {
    throw new Error(`Failed to create auth user A: ${createdA.error?.message ?? 'unknown error'}`);
  }
  authUserA = createdA.data.user;

  const createdB = await adminClient.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (createdB.error || !createdB.data.user) {
    throw new Error(`Failed to create auth user B: ${createdB.error?.message ?? 'unknown error'}`);
  }
  authUserB = createdB.data.user;

  await sql.begin(async (tx) => {
    await tx`
      insert into public.organizations (id, name, slug, type, timezone)
      values
        (${orgA}, 'Phase 3 Org A', ${`${runId}-a`}, 'household', 'America/Los_Angeles'),
        (${orgB}, 'Phase 3 Org B', ${`${runId}-b`}, 'household', 'America/Los_Angeles')
    `;

    await tx`
      insert into public.adult_users (id, auth_user_id, email, full_name)
      values
        (${adultA}, ${authUserA.id}, ${emailA}, 'Phase 3 Parent A'),
        (${adultB}, ${authUserB.id}, ${emailB}, 'Phase 3 Parent B')
    `;

    await tx`
      insert into public.memberships (id, organization_id, adult_user_id, role, is_default)
      values
        (${membershipA}, ${orgA}, ${adultA}, 'owner', true),
        (${membershipB}, ${orgB}, ${adultB}, 'owner', true)
    `;

    await tx`
      insert into public.learners (id, organization_id, first_name, last_name, display_name, date_of_birth)
      values
        (${learnerA}, ${orgA}, 'Ava', 'Alpha', 'Ava Alpha', '2016-01-01'),
        (${learnerB}, ${orgB}, 'Ben', 'Beta', 'Ben Beta', '2016-01-01')
    `;

    await tx`
      insert into public.recommendations (
        id,
        organization_id,
        learner_id,
        recommendation_type,
        status,
        title,
        description
      )
      values
        (${recommendationA}, ${orgA}, ${learnerA}, 'schedule_adjustment', 'proposed', 'Rec A', 'Org A recommendation'),
        (${recommendationB}, ${orgB}, ${learnerB}, 'schedule_adjustment', 'proposed', 'Rec B', 'Org B recommendation')
    `;

    await tx`
      insert into public.compliance_programs (
        id,
        organization_id,
        learner_id,
        school_year_label,
        start_date,
        end_date,
        jurisdiction_code,
        pathway_code,
        requirement_profile_version,
        grade_band,
        status
      )
      values
        (${complianceProgramA}, ${orgA}, ${learnerA}, '2025-2026', '2025-08-15', '2026-05-30', 'US-TX', 'homeschool_record_pack', '2026-04', 'elementary', 'active'),
        (${complianceProgramB}, ${orgB}, ${learnerB}, '2025-2026', '2025-08-15', '2026-05-30', 'US-FL', 'home_education', '2026-04', 'elementary', 'active')
    `;

    await tx`
      insert into public.compliance_tasks (
        id,
        compliance_program_id,
        task_type,
        title,
        due_date,
        status
      )
      values
        (${complianceTaskA}, ${complianceProgramA}, 'attendance_summary', 'Attendance summary ready', '2026-05-30', 'ready'),
        (${complianceTaskB}, ${complianceProgramB}, 'attendance_summary', 'Attendance summary ready', '2026-05-30', 'ready')
    `;
  });

  const clientA = await signIn(url, anonKey, emailA, password);
  const clientB = await signIn(url, anonKey, emailB, password);

  await expectQueryIds(
    'client A recommendations select',
    clientA.from('recommendations').select('id'),
    [recommendationA],
  );
  await expectQueryIds(
    'client B recommendations select',
    clientB.from('recommendations').select('id'),
    [recommendationB],
  );

  await expectQueryIds(
    'client A learners select',
    clientA.from('learners').select('id'),
    [learnerA],
  );
  await expectQueryIds(
    'client B learners select',
    clientB.from('learners').select('id'),
    [learnerB],
  );

  await expectQueryIds(
    'client A compliance programs select',
    clientA.from('compliance_programs').select('id'),
    [complianceProgramA],
  );
  await expectQueryIds(
    'client B compliance programs select',
    clientB.from('compliance_programs').select('id'),
    [complianceProgramB],
  );

  await expectQueryIds(
    'client A compliance tasks select',
    clientA.from('compliance_tasks').select('id'),
    [complianceTaskA],
  );
  await expectQueryIds(
    'client B compliance tasks select',
    clientB.from('compliance_tasks').select('id'),
    [complianceTaskB],
  );

  const ownOrgSelect = await clientA.from('organizations').select('id');
  if (ownOrgSelect.error) {
    throw new Error(`client A organizations select failed: ${ownOrgSelect.error.message}`);
  }
  const ownOrgIds = (ownOrgSelect.data ?? []).map((row) => row.id);
  if (!ownOrgIds.includes(orgA) || ownOrgIds.includes(orgB)) {
    throw new Error(`client A organizations scope incorrect: ${JSON.stringify(ownOrgIds)}`);
  }

  await expectError('client A cross-org recommendation insert', () =>
    clientA.from('recommendations').insert({
      id: `recommendation_${runId}_forbidden`,
      organization_id: orgB,
      learner_id: learnerB,
      recommendation_type: 'schedule_adjustment',
      status: 'proposed',
      title: 'Forbidden recommendation',
      description: 'Should be rejected by RLS',
    }),
  );

  await expectError('client A cross-org learner insert', () =>
    clientA.from('learners').insert({
      id: `learner_${runId}_forbidden`,
      organization_id: orgB,
      first_name: 'Cross',
      last_name: 'Org',
      display_name: 'Cross Org',
      date_of_birth: '2016-01-01',
    }),
  );

  await expectError('client A cross-org compliance program insert', () =>
    clientA.from('compliance_programs').insert({
      id: `program_${runId}_forbidden`,
      organization_id: orgB,
      learner_id: learnerB,
      school_year_label: '2025-2026',
      start_date: '2025-08-15',
      end_date: '2026-05-30',
      jurisdiction_code: 'US-PA',
      pathway_code: 'home_education',
      requirement_profile_version: '2026-04',
      grade_band: 'elementary',
      status: 'active',
    }),
  );

  const ownSnapshotInsert = await clientA.from('compliance_progress_snapshots').insert({
    id: `snapshot_${runId}_own`,
    compliance_program_id: complianceProgramA,
    period_type: 'quarter',
    period_label: 'Q1',
    summary_text: 'Own compliance snapshot',
  });
  if (ownSnapshotInsert.error) {
    throw new Error(`client A own compliance snapshot insert failed: ${ownSnapshotInsert.error.message}`);
  }

  await expectError('client A cross-org compliance snapshot insert', () =>
    clientA.from('compliance_progress_snapshots').insert({
      id: `snapshot_${runId}_forbidden`,
      compliance_program_id: complianceProgramB,
      period_type: 'quarter',
      period_label: 'Q1',
      summary_text: 'Forbidden snapshot',
    }),
  );

  await expectError('client A cross-program attendance insert', () =>
    clientA.from('homeschool_attendance_records').insert({
      id: `attendance_${runId}_forbidden`,
      organization_id: orgA,
      learner_id: learnerA,
      compliance_program_id: complianceProgramB,
      attendance_date: '2026-01-15',
      status: 'present',
      source: 'manual',
      minutes: 240,
    }),
  );

  await expectError('client A cross-program evidence insert', () =>
    clientA.from('evidence_records').insert({
      id: `evidence_${runId}_forbidden`,
      organization_id: orgA,
      learner_id: learnerA,
      compliance_program_id: complianceProgramB,
      evidence_type: 'note',
      title: 'Forbidden evidence link',
    }),
  );

  const artifactPathA = `${orgA}/artifacts/${runId}/own.txt`;
  const artifactPathB = `${orgB}/artifacts/${runId}/other.txt`;
  const learnerUploadA = `${orgA}/learners/${learnerA}/${runId}.txt`;
  const learnerUploadB = `${orgB}/learners/${learnerB}/${runId}.txt`;

  const ownArtifactUpload = await clientA.storage
    .from('generated-artifacts')
    .upload(artifactPathA, new Blob(['owned artifact'], { type: 'text/plain' }), {
      contentType: 'text/plain',
      upsert: true,
    });
  if (ownArtifactUpload.error) {
    throw new Error(`client A own artifact upload failed: ${ownArtifactUpload.error.message}`);
  }

  const orgBArtifactUpload = await clientB.storage
    .from('generated-artifacts')
    .upload(artifactPathB, new Blob(['org b artifact'], { type: 'text/plain' }), {
      contentType: 'text/plain',
      upsert: true,
    });
  if (orgBArtifactUpload.error) {
    throw new Error(`client B own artifact upload failed: ${orgBArtifactUpload.error.message}`);
  }

  await expectError('client A cross-org artifact upload', () =>
    clientA.storage
      .from('generated-artifacts')
      .upload(artifactPathB, new Blob(['forbidden'], { type: 'text/plain' }), {
        contentType: 'text/plain',
        upsert: true,
      }),
  );

  const ownLearnerUpload = await clientA.storage
    .from('learner-uploads')
    .upload(learnerUploadA, new Blob(['owned learner upload'], { type: 'text/plain' }), {
      contentType: 'text/plain',
      upsert: true,
    });
  if (ownLearnerUpload.error) {
    throw new Error(`client A own learner upload failed: ${ownLearnerUpload.error.message}`);
  }

  await expectError('client A cross-org learner upload', () =>
    clientA.storage
      .from('learner-uploads')
      .upload(learnerUploadB, new Blob(['forbidden learner upload'], { type: 'text/plain' }), {
        contentType: 'text/plain',
        upsert: true,
      }),
  );

  const foreignArtifactDownload = await clientA.storage
    .from('generated-artifacts')
    .download(artifactPathB);
  if (!foreignArtifactDownload.error) {
    throw new Error('client A cross-org artifact download unexpectedly succeeded');
  }

  console.log(JSON.stringify({
    runId,
    status: 'ok',
    checks: [
      'recommendation select isolation',
      'learner select isolation',
      'compliance program select isolation',
      'compliance task select isolation',
      'organization visibility isolation',
      'cross-org recommendation insert denied',
      'cross-org learner insert denied',
      'cross-org compliance program insert denied',
      'own compliance snapshot insert allowed',
      'cross-org compliance snapshot insert denied',
      'cross-program attendance insert denied',
      'cross-program evidence insert denied',
      'generated-artifacts storage isolation',
      'learner-uploads storage isolation',
    ],
  }, null, 2));
} finally {
  try {
    await sql`delete from public.organizations where id in (${orgA}, ${orgB})`;
  } catch {}

  try {
    if (authUserA?.id) {
      await adminClient.auth.admin.deleteUser(authUserA.id);
    }
  } catch {}

  try {
    if (authUserB?.id) {
      await adminClient.auth.admin.deleteUser(authUserB.id);
    }
  } catch {}

  await sql.end({ timeout: 1 });
}
