import { eq } from "drizzle-orm";

import { createRepositories } from "../lib/db/index.ts";
import { getDb, ensureDatabaseReady } from "../lib/db/server.ts";
import { adultUsers, learners, lessonSessions, planDays, planItems, plans } from "../lib/db/schema/index.ts";
import type { ActivitySpec } from "../lib/activities/spec.ts";

const QA_EMAIL = "qa.single.parent.local+01@example.com";

function buildSmokeSpec(): ActivitySpec {
  return {
    schemaVersion: "2",
    title: "Builder Evidence Upload Smoke",
    purpose: "Upload both a file and a photo so the activity runtime can persist durable lesson evidence.",
    activityKind: "offline_real_world",
    linkedObjectiveIds: [],
    linkedSkillLabels: ["builder evidence"],
    estimatedMinutes: 10,
    interactionMode: "offline",
    components: [
      {
        type: "paragraph",
        id: "intro",
        text: "Upload a plan file and a photo from the build so both assets become lesson evidence.",
      },
      {
        type: "file_upload",
        id: "plan-file",
        prompt: "Upload the build plan or notes file.",
        notePrompt: "What changed after you tested the build?",
        accept: [".txt", ".md", ".pdf"],
        maxFiles: 1,
        required: true,
      },
      {
        type: "image_capture",
        id: "build-photo",
        prompt: "Upload a photo of the finished build.",
        instructions: "A single photo is enough for this smoke test.",
        maxImages: 1,
        required: true,
      },
    ],
    completionRules: {
      strategy: "all_interactive_components",
      incompleteMessage: "Upload both the file and the photo before submitting.",
    },
    evidenceSchema: {
      captureKinds: ["file_artifact", "image_artifact"],
      requiresReview: true,
      autoScorable: false,
    },
    scoringModel: {
      mode: "teacher_observed",
      masteryThreshold: 0.8,
      reviewThreshold: 0.6,
    },
    offlineMode: {
      offlineTaskDescription: "Use any small local file plus one photo so the runtime can save both as lesson evidence.",
      evidenceCaptureInstruction: "Submit after both uploads finish.",
    },
  };
}

async function main() {
  await ensureDatabaseReady();
  const db = getDb();
  const repos = createRepositories(db);

  const adultUser = await db.query.adultUsers.findFirst({
    where: eq(adultUsers.email, QA_EMAIL),
  });

  if (!adultUser) {
    throw new Error(`Could not find local QA account for ${QA_EMAIL}.`);
  }

  const membership = await db.query.memberships.findFirst({
    where: (table, { eq }) => eq(table.adultUserId, adultUser.id),
    orderBy: (table, { desc }) => [desc(table.isDefault), desc(table.createdAt)],
  });

  if (!membership) {
    throw new Error(`Could not find a workspace membership for ${QA_EMAIL}.`);
  }

  const learner = await db.query.learners.findFirst({
    where: eq(learners.organizationId, membership.organizationId),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  if (!learner) {
    throw new Error(`Could not find a learner for organization ${membership.organizationId}.`);
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const today = new Date().toISOString().slice(0, 10);

  const planId = `plan-upload-smoke-${stamp}`;
  const dayId = `day-upload-smoke-${stamp}`;
  const planItemId = `planitem-upload-smoke-${stamp}`;
  const sessionId = `session-upload-smoke-${stamp}`;
  const activityId = `activity-upload-smoke-${stamp}`;

  await db.insert(plans).values({
    id: planId,
    organizationId: membership.organizationId,
    learnerId: learner.id,
    title: "Activity upload smoke plan",
    status: "active",
    startDate: today,
    metadata: {
      source: "qa-upload-smoke",
    },
  });

  await db.insert(planDays).values({
    id: dayId,
    planId,
    date: today,
    status: "planned",
    metadata: {
      source: "qa-upload-smoke",
    },
  });

  await db.insert(planItems).values({
    id: planItemId,
    planId,
    planDayId: dayId,
    curriculumItemId: null,
    title: "Activity upload smoke",
    description: "Upload durable learner evidence from the activity runtime.",
    subject: "Builder QA",
    status: "ready",
    scheduledDate: today,
    estimatedMinutes: 10,
    ordering: 0,
    metadata: {
      source: "qa-upload-smoke",
      standardIds: [],
    },
  });

  await db.insert(lessonSessions).values({
    id: sessionId,
    organizationId: membership.organizationId,
    learnerId: learner.id,
    planId,
    planDayId: dayId,
    planItemId,
    sessionDate: today,
    workspaceType: "homeschool_day",
    status: "planned",
    completionStatus: "not_started",
    reviewState: "not_required",
    reviewRequired: false,
    actualMinutes: null,
    scheduledMinutes: 10,
    startedAt: null,
    completedAt: null,
    reviewedAt: null,
    reviewedByAdultUserId: null,
    summary: null,
    notes: null,
    retrospective: null,
    nextAction: null,
    deviationReason: null,
    metadata: {
      source: "qa-upload-smoke",
      standardIds: [],
    },
  });

  await repos.activities.upsertActivity({
    id: activityId,
    organizationId: membership.organizationId,
    learnerId: learner.id,
    planItemId,
    lessonSessionId: sessionId,
    activityType: "activity_spec",
    status: "published",
    title: "Builder Evidence Upload Smoke",
    schemaVersion: "2",
    definition: buildSmokeSpec() as unknown as Record<string, unknown>,
    metadata: {
      source: "qa-upload-smoke",
      sessionId,
      standardIds: [],
      estimatedMinutes: 10,
      lessonId: sessionId,
    },
  });

  console.log(
    JSON.stringify({
      sessionId,
      activityId,
      learnerId: learner.id,
      organizationId: membership.organizationId,
      loginEmail: QA_EMAIL,
    }),
  );
}

await main();
