import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import {
  curriculumNodes,
  curriculumSources,
  goalMappings,
  learnerProfiles,
  learningGoals,
  observationNotes,
  planItemCurriculumLinks,
  progressRecords,
  progressRecordStandards,
  standardNodes,
  weeklyRouteItems,
  weeklyRoutes,
} from "@/lib/db/schema";
import { buildStandardsExportRows, buildTrackingExportRows } from "@/lib/tracking/export";
import type {
  TrackingCurriculumContext,
  EvidenceRecord,
  GoalProgressRow,
  MasterySignal,
  ObservationEntry,
  StandardCoverageRow,
  TrackingDashboard,
  TrackingOutcome,
} from "@/lib/tracking/types";

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function safeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getMetadataString(value: unknown, key: string) {
  const record = asRecord(value);
  return typeof record?.[key] === "string" ? record[key] : undefined;
}

function getCurriculumLinkSourceId(value: unknown) {
  const record = asRecord(value);
  const curriculumLink = asRecord(record?.curriculumLink);
  return typeof curriculumLink?.sourceId === "string" ? curriculumLink.sourceId : undefined;
}

function mapMastery(value: string | null): MasterySignal {
  if (value === "secure" || value === "developing" || value === "emerging" || value === "needs_review") {
    return value;
  }

  return "needs_review";
}

function mapOutcomeStatus(value: string) {
  switch (value) {
    case "completed":
    case "mastered":
      return "completed" as const;
    case "in_progress":
      return "partial" as const;
    default:
      return "skipped" as const;
  }
}

function mapObservationTone(value: string) {
  switch (value) {
    case "mastery":
      return "bright_spot" as const;
    case "adaptation_signal":
      return "adjustment" as const;
    default:
      return "watch" as const;
  }
}

function defaultReportingWindow() {
  const now = new Date();
  return `Week of ${now.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

async function buildCurriculumContext(args: {
  sourceId: string;
  selectionReason: string;
  weekStartDate?: string | null;
  weeklyRouteId?: string;
}): Promise<TrackingCurriculumContext | null> {
  const db = getDb();
  const source = await db.query.curriculumSources.findFirst({
    where: eq(curriculumSources.id, args.sourceId),
  });

  if (!source) {
    return null;
  }

  const [nodes, routeItems] = await Promise.all([
    db.query.curriculumNodes.findMany({
      where: and(eq(curriculumNodes.sourceId, source.id), eq(curriculumNodes.isActive, true)),
      columns: {
        id: true,
        normalizedType: true,
      },
    }),
    args.weeklyRouteId
      ? db.query.weeklyRouteItems.findMany({
          where: eq(weeklyRouteItems.weeklyRouteId, args.weeklyRouteId),
          columns: {
            id: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    sourceId: source.id,
    sourceTitle: source.title,
    selectionReason: args.selectionReason,
    weekStartDate: args.weekStartDate ?? undefined,
    scheduledItemCount: routeItems.length,
    totalNodeCount: nodes.length,
    totalSkillCount: nodes.filter((node) => node.normalizedType === "skill").length,
  };
}

async function resolveActiveCurriculumContext(params: {
  organizationId: string;
  learnerId: string;
}): Promise<TrackingCurriculumContext | null> {
  const db = getDb();

  const latestWeeklyRoute = await db.query.weeklyRoutes.findFirst({
    where: and(eq(weeklyRoutes.learnerId, params.learnerId), eq(weeklyRoutes.status, "active")),
    orderBy: [desc(weeklyRoutes.weekStartDate), desc(weeklyRoutes.createdAt)],
  });

  if (latestWeeklyRoute) {
    return buildCurriculumContext({
      sourceId: latestWeeklyRoute.sourceId,
      selectionReason: "Latest weekly route",
      weekStartDate: latestWeeklyRoute.weekStartDate,
      weeklyRouteId: latestWeeklyRoute.id,
    });
  }

  const learnerScopedSource = await db.query.curriculumSources.findFirst({
    where: and(
      eq(curriculumSources.organizationId, params.organizationId),
      eq(curriculumSources.learnerId, params.learnerId),
      eq(curriculumSources.status, "active"),
    ),
    orderBy: [desc(curriculumSources.updatedAt), desc(curriculumSources.createdAt)],
  });

  if (learnerScopedSource) {
    return buildCurriculumContext({
      sourceId: learnerScopedSource.id,
      selectionReason: "Learner-scoped active curriculum",
    });
  }

  const organizationScopedSource = await db.query.curriculumSources.findFirst({
    where: and(
      eq(curriculumSources.organizationId, params.organizationId),
      eq(curriculumSources.status, "active"),
    ),
    orderBy: [desc(curriculumSources.updatedAt), desc(curriculumSources.createdAt)],
  });

  if (organizationScopedSource) {
    return buildCurriculumContext({
      sourceId: organizationScopedSource.id,
      selectionReason: "Most recent household curriculum",
    });
  }

  return null;
}

export async function getTrackingDashboard(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
}): Promise<TrackingDashboard> {
  const db = getDb();

  const [profile, curriculum, progressCandidates, noteCandidates, goals] = await Promise.all([
    db.query.learnerProfiles.findFirst({
      where: eq(learnerProfiles.learnerId, params.learnerId),
    }),
    resolveActiveCurriculumContext({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
    }),
    db.query.progressRecords.findMany({
      where: eq(progressRecords.learnerId, params.learnerId),
      orderBy: [desc(progressRecords.createdAt)],
      limit: 100,
    }),
    db.query.observationNotes.findMany({
      where: and(
        eq(observationNotes.organizationId, params.organizationId),
        eq(observationNotes.learnerId, params.learnerId),
      ),
      orderBy: [desc(observationNotes.createdAt)],
      limit: 100,
    }),
    db.query.learningGoals.findMany({
      where: eq(learningGoals.learnerId, params.learnerId),
      orderBy: [desc(learningGoals.updatedAt)],
      limit: 25,
    }),
  ]);

  const planItemIds = [...new Set(
    [...progressCandidates, ...noteCandidates]
      .map((row) => row.planItemId)
      .filter((value): value is string => typeof value === "string"),
  )];
  const planItemLinks =
    planItemIds.length === 0
      ? []
      : await db.query.planItemCurriculumLinks.findMany({
          where: inArray(planItemCurriculumLinks.planItemId, planItemIds),
        });
  const sourceIdByPlanItemId = new Map(planItemLinks.map((row) => [row.planItemId, row.sourceId]));

  const progressSourceIdByRecordId = new Map(
    progressCandidates.map((row) => [
      row.id,
      getCurriculumLinkSourceId(row.metadata) ??
        (row.planItemId ? sourceIdByPlanItemId.get(row.planItemId) : undefined),
    ]),
  );

  const progress = curriculum
    ? progressCandidates
        .filter((row) => progressSourceIdByRecordId.get(row.id) === curriculum.sourceId)
        .slice(0, 25)
    : progressCandidates.slice(0, 25);
  const filteredProgressIds = new Set(progress.map((row) => row.id));

  const notes = curriculum
    ? noteCandidates
        .filter((note) => {
          const linkedProgressId = getMetadataString(note.metadata, "progressRecordId");
          if (linkedProgressId && filteredProgressIds.has(linkedProgressId)) {
            return true;
          }

          const linkedSourceId =
            getCurriculumLinkSourceId(note.metadata) ??
            (note.planItemId ? sourceIdByPlanItemId.get(note.planItemId) : undefined) ??
            (linkedProgressId ? progressSourceIdByRecordId.get(linkedProgressId) : undefined);

          return linkedSourceId === curriculum.sourceId;
        })
        .slice(0, 25)
    : noteCandidates.slice(0, 25);

  const progressIds = progress.map((row) => row.id);
  const standardLinks =
    progressIds.length === 0
      ? []
      : await db.query.progressRecordStandards.findMany({
          where: inArray(progressRecordStandards.progressRecordId, progressIds),
        });

  const standardNodeIds = [...new Set(standardLinks.map((row) => row.standardNodeId))];
  const linkedStandards =
    standardNodeIds.length === 0
      ? []
      : await db.query.standardNodes.findMany({
          where: inArray(standardNodes.id, standardNodeIds),
        });

  const standardCodeById = new Map(linkedStandards.map((row) => [row.id, row.code]));
  const standardLabelById = new Map(
    linkedStandards.map((row) => [row.id, row.description ?? row.title]),
  );
  const standardSubjectById = new Map(linkedStandards.map((row) => [row.id, row.subject ?? "General"]));

  const standardsByProgressId = new Map<string, string[]>();
  for (const link of standardLinks) {
    const current = standardsByProgressId.get(link.progressRecordId) ?? [];
    current.push(standardCodeById.get(link.standardNodeId) ?? link.standardNodeId);
    standardsByProgressId.set(link.progressRecordId, current);
  }

  const outcomes: TrackingOutcome[] = progress.map((row) => {
    const metadata = row.metadata ?? {};
    const plannedMinutes =
      typeof metadata.plannedMinutes === "number" && Number.isFinite(metadata.plannedMinutes)
        ? Math.max(0, metadata.plannedMinutes)
        : 0;
    const actualMinutes = row.timeSpentMinutes ?? 0;
    const standardCodes = standardsByProgressId.get(row.id) ?? [];

    return {
      id: row.id,
      date: toDateOnly(row.createdAt),
      title: safeText(metadata.activityTitle, "Learning record"),
      subject: safeText(metadata.subject, "General"),
      plannedMinutes,
      actualMinutes,
      status: mapOutcomeStatus(row.status),
      mastery: mapMastery(row.masteryLevel),
      standards: standardCodes,
      goals: Array.isArray(metadata.goalTitles)
        ? metadata.goalTitles.filter((value): value is string => typeof value === "string")
        : [],
      deviationNote: typeof row.parentNote === "string" ? row.parentNote : undefined,
      evidenceCount: standardCodes.length,
    };
  });

  const observations: ObservationEntry[] = notes.map((note) => ({
    id: note.id,
    date: toDateOnly(note.createdAt),
    title: safeText(note.metadata?.title, "Observation"),
    tone: mapObservationTone(note.noteType),
    body: note.body,
    linkedOutcomeId: typeof note.metadata?.progressRecordId === "string" ? note.metadata.progressRecordId : undefined,
  }));

  const evidence: EvidenceRecord[] = progress.map((row) => {
    const metadata = row.metadata ?? {};
    return {
      id: `evidence-${row.id}`,
      title: safeText(metadata.evidenceTitle, safeText(metadata.activityTitle, "Learning evidence")),
      kind: "activity",
      linkedTo: safeText(metadata.activityTitle, "Learning record"),
      capturedAt: row.createdAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      note: safeText(metadata.evidenceNote, row.parentNote ?? "Recorded from activity progress."),
    };
  });

  const standardStats = new Map<
    string,
    { code: string; label: string; subject: string; evidenceCount: number; latestEvidence: string }
  >();

  for (const link of standardLinks) {
    const code = standardCodeById.get(link.standardNodeId) ?? link.standardNodeId;
    const label = standardLabelById.get(link.standardNodeId) ?? code;
    const subject = standardSubjectById.get(link.standardNodeId) ?? "General";
    const current = standardStats.get(link.standardNodeId);

    if (!current) {
      standardStats.set(link.standardNodeId, {
        code,
        label,
        subject,
        evidenceCount: 1,
        latestEvidence: "Progress record",
      });
      continue;
    }

    current.evidenceCount += 1;
  }

  const standards: StandardCoverageRow[] = Array.from(standardStats.entries()).map(
    ([standardNodeId, value]) => ({
      id: standardNodeId,
      code: value.code,
      label: value.label,
      subject: value.subject,
      status: value.evidenceCount > 1 ? "covered" : "in_progress",
      evidenceCount: value.evidenceCount,
      latestEvidence: value.latestEvidence,
    }),
  );

  const goalIds = goals.map((goal) => goal.id);
  const mappings =
    goalIds.length === 0
      ? []
      : await db.query.goalMappings.findMany({
          where: inArray(goalMappings.learningGoalId, goalIds),
        });

  const standardCodesByGoalId = new Map<string, string[]>();
  for (const mapping of mappings) {
    const current = standardCodesByGoalId.get(mapping.learningGoalId) ?? [];
    current.push(standardCodeById.get(mapping.standardNodeId) ?? mapping.standardNodeId);
    standardCodesByGoalId.set(mapping.learningGoalId, current);
  }

  const goalRows: GoalProgressRow[] = goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    subject: goal.subject ?? "General",
    progressLabel:
      goal.status === "completed"
        ? "Completed"
        : goal.status === "active"
          ? "In progress"
          : "Not started",
    nextMove: safeText(goal.description, "Capture one specific next action for this goal."),
    linkedStandards: standardCodesByGoalId.get(goal.id) ?? [],
  }));

  const plannedMinutes = outcomes.reduce((total, item) => total + item.plannedMinutes, 0);
  const actualMinutes = outcomes.reduce((total, item) => total + item.actualMinutes, 0);
  const completedCount = outcomes.filter((item) => item.status === "completed").length;
  const secureCount = outcomes.filter((item) => item.mastery === "secure").length;
  const needsAttentionCount = outcomes.filter((item) => item.mastery === "needs_review").length;

  return {
    learner: {
      id: params.learnerId,
      name: params.learnerName,
      gradeLabel: profile?.gradeLevel ? `Grade ${profile.gradeLevel}` : "Grade level not set",
      reportingWindow: defaultReportingWindow(),
    },
    curriculum,
    summary: {
      plannedMinutes,
      actualMinutes,
      completionRate: outcomes.length === 0 ? 0 : Math.round((completedCount / outcomes.length) * 100),
      secureCount,
      needsAttentionCount,
    },
    outcomes,
    observations,
    evidence,
    standards,
    goals: goalRows,
  };
}

export function getTrackingExportPreview(dashboard: TrackingDashboard) {
  return {
    lessonRows: buildTrackingExportRows(dashboard),
    standardRows: buildStandardsExportRows(dashboard),
  };
}

export function formatTrackingDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

export function formatOutcomeDelta(plannedMinutes: number, actualMinutes: number) {
  const delta = actualMinutes - plannedMinutes;

  if (delta === 0) {
    return "On plan";
  }

  if (delta > 0) {
    return `+${delta} min over`;
  }

  return `${Math.abs(delta)} min under`;
}
