import "@/lib/server-only";

import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";

import {
  getLearnerComplianceProgram,
  getRequirementProfileSummary,
  listAttendanceLedger,
  listComplianceReportDrafts,
  listComplianceTasksForProgram,
  listProgressSnapshotsForProgram,
  summarizeAttendanceProgress,
} from "@/lib/compliance/service";
import type {
  AttendanceLedgerEntry,
  ProgressSnapshotSummary,
  RequirementProfile,
  SubjectCoverageSummary,
} from "@/lib/compliance/types";
import { getDb } from "@/lib/db/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
import {
  complianceEvaluationRecords,
  curriculumNodes,
  curriculumSources,
  evidenceRecordObjectives,
  evidenceRecords,
  feedbackEntries,
  goalMappings,
  learnerProfiles,
  lessonSessions,
  learningGoals,
  observationNotes,
  planItems,
  planItemCurriculumLinks,
  progressRecords,
  progressRecordStandards,
  recommendations,
  reviewQueueItems,
  standardNodes,
  weeklyRouteItems,
  weeklyRoutes,
} from "@/lib/db/schema";
import { buildStandardsExportRows, buildTrackingExportRows } from "@/lib/tracking/export";
import type {
  AdaptationRecommendation,
  EvaluationEntry,
  ReviewQueueEntry,
  TrackingCurriculumContext,
  EvidenceRecord,
  GoalProgressRow,
  MasterySignal,
  ObservationEntry,
  StandardCoverageRow,
  TrackingDashboard,
  TrackingOutcome,
} from "@/lib/tracking/types";

type ComplianceEvaluationRow = typeof complianceEvaluationRecords.$inferSelect;

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

function mapEvidenceKind(value: string): EvidenceRecord["kind"] {
  switch (value) {
    case "photo":
      return "photo";
    case "audio_video_metadata":
      return "audio";
    case "file_upload":
    case "artifact_output":
    case "external_assessment":
      return "worksheet";
    case "note":
    case "review_note":
      return "note";
    default:
      return "activity";
  }
}

function mapEvaluationLevel(
  value: unknown,
  rating: number | null | undefined,
): EvaluationEntry["level"] {
  if (
    value === "needs_more_work" ||
    value === "partial" ||
    value === "successful" ||
    value === "exceeded"
  ) {
    return value;
  }

  switch (rating) {
    case 1:
      return "needs_more_work";
    case 2:
      return "partial";
    case 3:
      return "successful";
    default:
      return "exceeded";
  }
}

function defaultReportingWindow() {
  const now = new Date();
  return `Week of ${now.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

function mergeAttendanceRecords(
  explicitRecords: AttendanceLedgerEntry[],
  sessionRows: Array<{ id: string; sessionDate: string; actualMinutes: number | null }>,
): AttendanceLedgerEntry[] {
  const explicitByDate = new Map(explicitRecords.map((record) => [record.date, record]));
  const grouped = new Map<
    string,
    { minutes: number; sessionIds: string[] }
  >();

  for (const session of sessionRows) {
    const current = grouped.get(session.sessionDate) ?? { minutes: 0, sessionIds: [] };
    current.minutes += session.actualMinutes ?? 0;
    current.sessionIds.push(session.id);
    grouped.set(session.sessionDate, current);
  }

  const merged = [...explicitRecords];
  for (const [date, summary] of grouped.entries()) {
    if (explicitByDate.has(date)) {
      continue;
    }

    merged.push({
      id: `derived-${date}`,
      date,
      status: summary.minutes > 0 ? "present" : "partial",
      instructionalMinutes: summary.minutes,
      source: "derived_from_sessions",
      note: "Suggested from recorded session outcomes.",
      derivedSessionIds: summary.sessionIds,
      isSuggested: true,
    });
  }

  return merged.sort((left, right) => right.date.localeCompare(left.date));
}

function buildSubjectCoverage(outcomes: TrackingOutcome[], profile: RequirementProfile | null) {
  const coverage = new Map<
    string,
    { label: string; minutesLogged: number; days: Set<string>; unitsTouched: number; lastCoveredAt: string | null; supportingRefs: string[] }
  >();

  const requiredKeys = new Set(profile?.requiredSubjectGroups.map((group) => group.key) ?? []);
  const labelByKey = new Map(
    (profile?.requiredSubjectGroups ?? []).map((group) => [group.key, group.label]),
  );

  for (const outcome of outcomes) {
    const subjectKey = outcome.subject.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const current = coverage.get(subjectKey) ?? {
      label: labelByKey.get(subjectKey) ?? outcome.subject,
      minutesLogged: 0,
      days: new Set<string>(),
      unitsTouched: 0,
      lastCoveredAt: null,
      supportingRefs: [],
    };

    current.minutesLogged += outcome.actualMinutes;
    current.days.add(outcome.date);
    current.unitsTouched += 1;
    current.lastCoveredAt = outcome.date;
    current.supportingRefs.push(outcome.id);
    coverage.set(subjectKey, current);
  }

  for (const group of profile?.requiredSubjectGroups ?? []) {
    if (!coverage.has(group.key)) {
      coverage.set(group.key, {
        label: group.label,
        minutesLogged: 0,
        days: new Set<string>(),
        unitsTouched: 0,
        lastCoveredAt: null,
        supportingRefs: [],
      });
    }
  }

  return Array.from(coverage.entries()).map<SubjectCoverageSummary>(([subjectKey, value]) => {
    const daysTouched = value.days.size;
    const hasStarted = value.minutesLogged > 0 || value.unitsTouched > 0;
    const coverageStatus =
      !hasStarted
        ? "not_started"
        : daysTouched >= 5 && value.minutesLogged >= 240
          ? "satisfied"
          : requiredKeys.has(subjectKey)
            ? "in_progress"
            : "unknown";

    return {
      subjectKey,
      label: value.label,
      minutesLogged: value.minutesLogged,
      daysTouched,
      unitsTouched: value.unitsTouched,
      lastCoveredAt: value.lastCoveredAt,
      coverageStatus,
      supportingRefs: value.supportingRefs,
    };
  });
}

function buildGeneratedSnapshots(params: {
  learnerName: string;
  outcomes: TrackingOutcome[];
  coverage: SubjectCoverageSummary[];
  evidence: EvidenceRecord[];
}): ProgressSnapshotSummary[] {
  if (params.outcomes.length === 0) {
    return [];
  }

  const completedCount = params.outcomes.filter((outcome) => outcome.status === "completed").length;
  const attentionSubjects = params.coverage
    .filter((row) => row.coverageStatus === "not_started" || row.coverageStatus === "in_progress")
    .slice(0, 3)
    .map((row) => row.label);
  const strengths = params.coverage
    .filter((row) => row.coverageStatus === "satisfied")
    .slice(0, 3)
    .map((row) => row.label);
  const subjectNotes = params.coverage.slice(0, 4).map((row) => ({
    subject: row.label,
    note:
      row.coverageStatus === "satisfied"
        ? `Coverage looks stronger here with ${row.daysTouched} logged days and ${row.minutesLogged} minutes.`
        : row.coverageStatus === "not_started"
          ? "No clear work has been captured for this subject yet."
          : `Work is underway here, but the record still needs more depth and evidence.`,
  }));

  const latestOutcomeDate = params.outcomes[0]?.date ?? new Date().toISOString().slice(0, 10);
  const yearLabel = latestOutcomeDate.slice(0, 4);

  return [
    {
      id: "generated-quarter",
      periodType: "quarter",
      periodLabel: `Quarter draft · ${yearLabel}`,
      summaryText: `${params.learnerName} completed ${completedCount} recorded lessons this period. Coverage is strongest where work has been repeated and evidence has been saved, while lighter subjects still need more durable proof.`,
      strengths: strengths.join(", ") || "Consistent follow-through in the main subjects.",
      struggles:
        attentionSubjects.join(", ") ||
        "A few lighter subjects still need more explicit work samples and minutes.",
      nextSteps:
        attentionSubjects.length > 0
          ? `Add one saved portfolio item or short narrative note for ${attentionSubjects.join(", ")} next.`
          : "Keep building the portfolio and quarterly narrative while the details are still fresh.",
      subjectNotes,
      evidenceRefs: params.evidence.slice(0, 6).map((record) => record.id),
      status: "draft",
    },
    {
      id: "generated-year",
      periodType: "year",
      periodLabel: `Annual draft · ${yearLabel}`,
      summaryText: `${params.learnerName}'s year record shows a usable attendance and portfolio trail tied back to actual work completed. The annual pack should focus on the strongest coverage areas, representative portfolio items, and any remaining subject gaps.`,
      strengths: strengths.join(", ") || "Attendance and evidence records stayed usable through the year.",
      struggles:
        attentionSubjects.join(", ") ||
        "No major subject gaps are visible in the current record.",
      nextSteps: "Finalize the annual summary and attach evaluation or testing evidence if the selected profile requires it.",
      subjectNotes,
      evidenceRefs: params.evidence.slice(0, 8).map((record) => record.id),
      status: "draft",
    },
  ];
}

function buildGeneratedReportDrafts(params: {
  learnerName: string;
  gradeLabel: string;
  programLabel: string;
  profile: RequirementProfile | null;
  attendanceSummary: TrackingDashboard["attendance"]["summary"];
  snapshots: ProgressSnapshotSummary[];
  tasks: TrackingDashboard["complianceTasks"];
  evidence: EvidenceRecord[];
}): TrackingDashboard["reportDrafts"] {
  const quarterlySnapshot = params.snapshots.find((snapshot) => snapshot.periodType === "quarter");
  const annualSnapshot = params.snapshots.find((snapshot) => snapshot.periodType === "year");
  const outstandingTasks = params.tasks.filter((task) => task.status !== "completed").slice(0, 6);

  return [
    {
      id: "generated-quarterly-report",
      reportKind: "quarterly_report",
      title: "Quarterly report draft",
      periodLabel: quarterlySnapshot?.periodLabel ?? params.programLabel,
      status: "draft",
      exportFileName: "quarterly-report-draft",
      content: [
        `${params.learnerName} · ${params.gradeLabel}`,
        "",
        quarterlySnapshot?.summaryText ?? "Add a quarter summary here.",
        "",
        `Attendance progress: ${params.attendanceSummary.progressLabel}`,
        quarterlySnapshot?.strengths ? `Strengths: ${quarterlySnapshot.strengths}` : null,
        quarterlySnapshot?.struggles ? `Needs more proof: ${quarterlySnapshot.struggles}` : null,
        quarterlySnapshot?.nextSteps ? `Next steps: ${quarterlySnapshot.nextSteps}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      id: "generated-annual-summary",
      reportKind: "annual_summary",
      title: "Annual summary draft",
      periodLabel: annualSnapshot?.periodLabel ?? params.programLabel,
      status: "draft",
      exportFileName: "annual-summary-draft",
      content: [
        `${params.learnerName} · ${params.gradeLabel}`,
        "",
        annualSnapshot?.summaryText ?? "Add a year-end summary here.",
        "",
        `Attendance progress: ${params.attendanceSummary.progressLabel}`,
        `Readiness signal: ${params.attendanceSummary.readinessLabel}`,
        annualSnapshot?.strengths ? `Stronger areas: ${annualSnapshot.strengths}` : null,
        annualSnapshot?.struggles ? `Items still to shore up: ${annualSnapshot.struggles}` : null,
        annualSnapshot?.nextSteps ? `Final pack note: ${annualSnapshot.nextSteps}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      id: "generated-evaluation-packet",
      reportKind: "evaluation_packet",
      title: "Evaluation packet shell",
      periodLabel: params.programLabel,
      status: "draft",
      exportFileName: "evaluation-packet-shell",
      content: [
        "Attach the annual summary, saved portfolio items, and any evaluator or test evidence required by the selected profile.",
        "",
        params.profile?.framingNote ?? "This is a working evidence packet, not an automated legal filing.",
      ].join("\n"),
    },
    {
      id: "generated-portfolio-checklist",
      reportKind: "portfolio_checklist",
      title: "Portfolio checklist",
      periodLabel: params.programLabel,
      status: "draft",
      exportFileName: "portfolio-checklist",
      content: [
        `Saved portfolio items: ${params.evidence.filter((item) => item.portfolioStatus === "saved").length}`,
        "",
        outstandingTasks.length > 0
          ? `Outstanding tasks:\n${outstandingTasks.map((task) => `- ${task.title} (${task.dueDate})`).join("\n")}`
          : "No open compliance tasks.",
      ].join("\n"),
    },
  ];
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
  const liveSource = await getLiveCurriculumSource(params.organizationId);

  const latestWeeklyRoute = await db.query.weeklyRoutes.findFirst({
    where: and(eq(weeklyRoutes.learnerId, params.learnerId), eq(weeklyRoutes.status, "active")),
    orderBy: [desc(weeklyRoutes.weekStartDate), desc(weeklyRoutes.createdAt)],
  });

  if (liveSource) {
    return buildCurriculumContext({
      sourceId: liveSource.id,
      selectionReason: "Live curriculum",
      ...(latestWeeklyRoute && latestWeeklyRoute.sourceId === liveSource.id
        ? {
            weekStartDate: latestWeeklyRoute.weekStartDate,
            weeklyRouteId: latestWeeklyRoute.id,
          }
        : {}),
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

  const [
    profile,
    complianceProgram,
    curriculum,
    progressCandidates,
    noteCandidates,
    feedbackCandidates,
    goals,
    evidenceCandidates,
    reviewCandidates,
    recommendationCandidates,
  ] = await Promise.all([
    db.query.learnerProfiles.findFirst({
      where: eq(learnerProfiles.learnerId, params.learnerId),
    }),
    getLearnerComplianceProgram({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
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
    db.query.feedbackEntries.findMany({
      where: and(
        eq(feedbackEntries.organizationId, params.organizationId),
        eq(feedbackEntries.learnerId, params.learnerId),
      ),
      orderBy: [desc(feedbackEntries.createdAt)],
      limit: 100,
    }),
    db.query.learningGoals.findMany({
      where: eq(learningGoals.learnerId, params.learnerId),
      orderBy: [desc(learningGoals.updatedAt)],
      limit: 25,
    }),
    db.query.evidenceRecords.findMany({
      where: and(
        eq(evidenceRecords.organizationId, params.organizationId),
        eq(evidenceRecords.learnerId, params.learnerId),
      ),
      orderBy: [desc(evidenceRecords.capturedAt), desc(evidenceRecords.createdAt)],
      limit: 100,
    }),
    db.query.reviewQueueItems.findMany({
      where: and(
        eq(reviewQueueItems.organizationId, params.organizationId),
        eq(reviewQueueItems.learnerId, params.learnerId),
      ),
      orderBy: [desc(reviewQueueItems.createdAt)],
      limit: 50,
    }),
    db.query.recommendations.findMany({
      where: and(
        eq(recommendations.organizationId, params.organizationId),
        eq(recommendations.learnerId, params.learnerId),
      ),
      orderBy: [desc(recommendations.createdAt)],
      limit: 25,
    }),
  ]);

  const planItemIds = [...new Set(
    [...progressCandidates, ...noteCandidates, ...evidenceCandidates, ...feedbackCandidates]
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
  const planItemTitleById =
    planItemIds.length === 0
      ? new Map<string, string>()
      : new Map(
          (
            await db.query.planItems.findMany({
              where: inArray(planItems.id, planItemIds),
            })
          ).map((item) => [item.id, item.title]),
        );

  const progressSourceIdByRecordId = new Map(
    progressCandidates.map((row) => [
      row.id,
      getCurriculumLinkSourceId(row.metadata) ??
        (row.planItemId ? sourceIdByPlanItemId.get(row.planItemId) : undefined),
    ]),
  );

  const useProgramScopedRecord = Boolean(complianceProgram);

  const progress = !useProgramScopedRecord && curriculum
    ? progressCandidates
        .filter((row) => progressSourceIdByRecordId.get(row.id) === curriculum.sourceId)
        .slice(0, 25)
    : progressCandidates.slice(0, 25);
  const filteredProgressIds = new Set(progress.map((row) => row.id));

  const evaluationCandidates = feedbackCandidates.filter(
    (row) => getMetadataString(row.metadata, "source") === "lesson_evaluation",
  );
  const evaluations = !useProgramScopedRecord && curriculum
    ? evaluationCandidates
        .filter((row) => {
          const linkedSourceId =
            (row.planItemId ? sourceIdByPlanItemId.get(row.planItemId) : undefined) ??
            getCurriculumLinkSourceId(row.metadata);

          return linkedSourceId === curriculum.sourceId;
        })
        .slice(0, 25)
    : evaluationCandidates.slice(0, 25);

  const notes = !useProgramScopedRecord && curriculum
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

  const evidence = !useProgramScopedRecord && curriculum
    ? evidenceCandidates
        .filter((record) => {
          const linkedSourceId =
            (record.planItemId ? sourceIdByPlanItemId.get(record.planItemId) : undefined) ??
            (record.progressRecordId ? progressSourceIdByRecordId.get(record.progressRecordId) : undefined) ??
            getCurriculumLinkSourceId(record.metadata);

          return linkedSourceId === curriculum.sourceId;
        })
        .slice(0, 25)
    : evidenceCandidates.slice(0, 25);

  const progressIds = progress.map((row) => row.id);
  const standardLinks =
    progressIds.length === 0
      ? []
      : await db.query.progressRecordStandards.findMany({
          where: inArray(progressRecordStandards.progressRecordId, progressIds),
        });

  const evidenceIds = evidence.map((record) => record.id);
  const evidenceObjectiveLinks =
    evidenceIds.length === 0
      ? []
      : await db.query.evidenceRecordObjectives.findMany({
          where: inArray(evidenceRecordObjectives.evidenceRecordId, evidenceIds),
        });

  const standardNodeIds = [...new Set([
    ...standardLinks.map((row) => row.standardNodeId),
    ...evidenceObjectiveLinks.map((row) => row.standardNodeId),
  ])];
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

  const evidenceCountByProgressId = new Map<string, number>();
  for (const record of evidence) {
    if (!record.progressRecordId) {
      continue;
    }

    evidenceCountByProgressId.set(
      record.progressRecordId,
      (evidenceCountByProgressId.get(record.progressRecordId) ?? 0) + 1,
    );
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
      evidenceCount: evidenceCountByProgressId.get(row.id) ?? standardCodes.length,
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

  const evaluationRows: EvaluationEntry[] = evaluations.map((record) => {
    const metadata = record.metadata ?? {};
    const resolvedLevel = mapEvaluationLevel(metadata.evaluationLevel, record.rating);
    const title =
      (record.planItemId ? planItemTitleById.get(record.planItemId) : undefined) ??
      safeText(metadata.evaluationLabel, "Lesson evaluation");

    return {
      id: record.id,
      date: toDateOnly(record.createdAt),
      title,
      level: resolvedLevel,
      note: safeText(record.body, safeText(metadata.note, "Lesson evaluation")),
    };
  });

  const mappedEvidence: EvidenceRecord[] = evidence.map((record) => ({
    id: record.id,
    title: record.title,
    kind: mapEvidenceKind(record.evidenceType),
    linkedTo:
      record.planItemId ??
      record.progressRecordId ??
      record.activityAttemptId ??
      "Learner evidence",
    capturedAt: record.capturedAt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    note: safeText(record.body, safeText(record.metadata?.summary, "Evidence captured.")),
    portfolioStatus: record.portfolioStatus,
    portfolioArtifactKind: record.portfolioArtifactKind ?? null,
    portfolioSubjectKey: record.portfolioSubjectKey ?? null,
    portfolioPeriodLabel: record.portfolioPeriodLabel ?? null,
    storagePath: record.storagePath ?? null,
  }));

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

  for (const link of evidenceObjectiveLinks) {
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
        latestEvidence: "Evidence record",
      });
      continue;
    }

    current.evidenceCount += 1;
    current.latestEvidence = "Evidence record";
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

  const reviewQueue: ReviewQueueEntry[] = reviewCandidates.map((item) => ({
    id: item.id,
    subjectType: item.subjectType,
    state: item.state,
    dueAt: item.dueAt?.toISOString(),
    decisionSummary: item.decisionSummary ?? undefined,
  }));

  const mappedRecommendations: AdaptationRecommendation[] = recommendationCandidates.map(
    (recommendation) => ({
      id: recommendation.id,
      title: recommendation.title,
      description: recommendation.description,
      status: recommendation.status,
      recommendationType: recommendation.recommendationType,
    }),
  );

  const plannedMinutes = outcomes.reduce((total, item) => total + item.plannedMinutes, 0);
  const actualMinutes = outcomes.reduce((total, item) => total + item.actualMinutes, 0);
  const completedCount = outcomes.filter((item) => item.status === "completed").length;
  const secureCount = outcomes.filter((item) => item.mastery === "secure").length;
  const needsAttentionCount = outcomes.filter((item) => item.mastery === "needs_review").length;
  const requirementProfile = getRequirementProfileSummary(complianceProgram);
  const subjectCoverage = buildSubjectCoverage(outcomes, requirementProfile);

  const [
    attendanceRecords,
    savedSnapshots,
    rawEvaluationRecords,
    complianceTasks,
    savedReportDrafts,
    attendanceSessionRows,
  ] =
    complianceProgram
      ? await Promise.all([
          listAttendanceLedger({
            organizationId: params.organizationId,
            learnerId: params.learnerId,
            startDate: complianceProgram.startDate,
            endDate: complianceProgram.endDate,
          }),
          listProgressSnapshotsForProgram(complianceProgram.id),
          db.query.complianceEvaluationRecords.findMany({
            where: eq(complianceEvaluationRecords.complianceProgramId, complianceProgram.id),
            orderBy: [
              desc(complianceEvaluationRecords.completedAt),
              desc(complianceEvaluationRecords.createdAt),
            ],
          }),
          listComplianceTasksForProgram(complianceProgram.id),
          listComplianceReportDrafts(complianceProgram.id),
          db.query.lessonSessions.findMany({
            where: and(
              eq(lessonSessions.organizationId, params.organizationId),
              eq(lessonSessions.learnerId, params.learnerId),
              gte(lessonSessions.sessionDate, complianceProgram.startDate),
              lte(lessonSessions.sessionDate, complianceProgram.endDate),
            ),
            columns: {
              id: true,
              sessionDate: true,
              actualMinutes: true,
            },
            orderBy: [desc(lessonSessions.sessionDate)],
          }),
        ])
      : await Promise.all([
          Promise.resolve([] as AttendanceLedgerEntry[]),
          Promise.resolve([]),
          Promise.resolve([] as ComplianceEvaluationRow[]),
          Promise.resolve([] as TrackingDashboard["complianceTasks"]),
          Promise.resolve([] as TrackingDashboard["reportDrafts"]),
          Promise.resolve([] as Array<{ id: string; sessionDate: string; actualMinutes: number | null }>),
        ]);

  const mergedAttendance = mergeAttendanceRecords(attendanceRecords, attendanceSessionRows);
  const attendanceSummary = summarizeAttendanceProgress({
    profile: requirementProfile,
    gradeBand: complianceProgram?.gradeBand ?? "elementary",
    records: mergedAttendance,
  });
  const evaluationRecords = rawEvaluationRecords.map((record) => ({
    id: record.id,
    evaluationType: record.evaluationType,
    completedAt: record.completedAt?.toISOString() ?? null,
    resultSummary: record.resultSummary,
    evaluatorName: record.evaluatorName ?? null,
    evaluatorRole: record.evaluatorRole ?? null,
    status: record.status,
  }));
  const generatedSnapshots = buildGeneratedSnapshots({
    learnerName: params.learnerName,
    outcomes,
    coverage: subjectCoverage,
    evidence: mappedEvidence,
  });
  const progressSnapshots = [
    ...savedSnapshots,
    ...generatedSnapshots.filter(
      (generated) =>
        !savedSnapshots.some(
          (snapshot) =>
            snapshot.periodType === generated.periodType &&
            snapshot.periodLabel === generated.periodLabel,
        ),
    ),
  ];
  const generatedReportDrafts = buildGeneratedReportDrafts({
    learnerName: params.learnerName,
    gradeLabel: profile?.gradeLevel ? `Grade ${profile.gradeLevel}` : "Grade level not set",
    programLabel:
      complianceProgram?.schoolYearLabel ??
      requirementProfile?.jurisdictionLabel ??
      "Current record pack",
    profile: requirementProfile,
    attendanceSummary,
    snapshots: progressSnapshots,
    tasks: complianceTasks,
    evidence: mappedEvidence,
  });
  const reportDrafts = [
    ...savedReportDrafts,
    ...generatedReportDrafts.filter(
      (generated) =>
        !savedReportDrafts.some(
          (draft) =>
            draft.reportKind === generated.reportKind &&
            draft.periodLabel === generated.periodLabel,
        ),
    ),
  ];

  return {
    learner: {
      id: params.learnerId,
      name: params.learnerName,
      gradeLabel: profile?.gradeLevel ? `Grade ${profile.gradeLevel}` : "Grade level not set",
      reportingWindow: defaultReportingWindow(),
    },
    curriculum,
    program: complianceProgram
      ? {
          id: complianceProgram.id,
          schoolYearLabel: complianceProgram.schoolYearLabel,
          startDate: complianceProgram.startDate,
          endDate: complianceProgram.endDate,
          jurisdictionCode: complianceProgram.jurisdictionCode,
          jurisdictionLabel:
            requirementProfile?.jurisdictionLabel ?? complianceProgram.jurisdictionCode,
          pathwayCode: complianceProgram.pathwayCode,
          pathwayLabel: requirementProfile?.pathwayLabel ?? complianceProgram.pathwayCode,
          gradeBand: complianceProgram.gradeBand,
          status: complianceProgram.status,
          framingNote:
            requirementProfile?.framingNote ??
            "Use this record pack to stay organized, not as legal advice.",
        }
      : null,
    requirementProfile,
    summary: {
      plannedMinutes,
      actualMinutes,
      completionRate: outcomes.length === 0 ? 0 : Math.round((completedCount / outcomes.length) * 100),
      secureCount,
      needsAttentionCount,
    },
    attendance: {
      summary: attendanceSummary,
      records: mergedAttendance,
    },
    outcomes,
    observations,
    evaluations: evaluationRows,
    progressSnapshots,
    evaluationRecords,
    evidence: mappedEvidence,
    portfolioSavedCount: mappedEvidence.filter((record) => record.portfolioStatus === "saved").length,
    subjectCoverage,
    standards,
    goals: goalRows,
    complianceTasks,
    reportDrafts,
    reviewQueue,
    recommendations: mappedRecommendations,
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

export async function updateRecommendationDecision(params: {
  organizationId: string;
  learnerId: string;
  recommendationId: string;
  action: "accept" | "override";
}) {
  const db = getDb();
  const recommendation = await db.query.recommendations.findFirst({
    where: and(
      eq(recommendations.id, params.recommendationId),
      eq(recommendations.organizationId, params.organizationId),
      eq(recommendations.learnerId, params.learnerId),
    ),
  });

  if (!recommendation) {
    return null;
  }

  const nextStatus = params.action === "accept" ? "accepted" : "dismissed";
  const [updated] = await db
    .update(recommendations)
    .set({
      status: nextStatus,
      acceptedAt: params.action === "accept" ? new Date().toISOString() : recommendation.acceptedAt,
      dismissedAt:
        params.action === "override" ? new Date().toISOString() : recommendation.dismissedAt,
      metadata: {
        ...(recommendation.metadata ?? {}),
        decisionAction: params.action,
      },
      updatedAt: new Date(),
    })
    .where(eq(recommendations.id, recommendation.id))
    .returning();

  return updated ?? null;
}

export async function recordObservationNote(params: {
  organizationId: string;
  learnerId: string;
  authorAdultUserId: string | null;
  noteType: "general" | "mastery" | "adaptation_signal";
  body: string;
  title?: string | null;
  planItemId?: string | null;
  lessonSessionId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const db = getDb();
  const [note] = await db
    .insert(observationNotes)
    .values({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      authorAdultUserId: params.authorAdultUserId,
      noteType: params.noteType,
      body: params.body,
      planItemId: params.planItemId ?? null,
      lessonSessionId: params.lessonSessionId ?? null,
      metadata: {
        ...(params.metadata ?? {}),
        title: params.title ?? null,
      },
    })
    .returning();

  if (!note) {
    throw new Error("Could not save the tracking note.");
  }

  return note;
}
