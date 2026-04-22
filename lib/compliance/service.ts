import "@/lib/server-only";

import { and, desc, eq } from "drizzle-orm";

import {
  getFallbackRequirementProfile,
  getRequirementProfile,
  listRequirementProfiles,
} from "@/lib/compliance/profiles";
import type {
  AttendanceLedgerEntry,
  AttendanceProgressSummary,
  ComplianceAttendanceSource,
  ComplianceGradeBand,
  CompliancePeriodType,
  ComplianceProgramDefinition,
  ComplianceProgramStatus,
  ComplianceReportDraftSummary,
  ComplianceReportKind,
  ComplianceSnapshotStatus,
  ComplianceTaskStatus,
  ComplianceTaskSummary,
  PortfolioArtifactKind,
  PortfolioEntryStatus,
  ProgressSnapshotSummary,
  RequirementProfile,
} from "@/lib/compliance/types";
import { createRepositories } from "@/lib/db";
import { ensureDatabaseReady, getDb } from "@/lib/db/server";
import {
  complianceTasks,
  compliancePrograms,
  evidenceRecords,
  homeschoolAttendanceRecords,
  learnerProfiles,
  planItems,
} from "@/lib/db/schema";
import { getHomeschoolHouseholdPreferences } from "@/lib/homeschool/preferences/service";
import { getAdminStorageClient } from "@/lib/storage/client";
import { storageBuckets } from "@/lib/storage";
import { buildLearnerStoragePath } from "@/lib/storage/paths";

function startOfDay(date: string) {
  return new Date(`${date}T12:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function titleCase(input: string) {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "portfolio-upload";
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function optionalNonEmptyString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalIsoDate(value: string | null | undefined) {
  const normalized = optionalNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function statusFromDueDate(
  dueDate: string,
  currentStatus?: ComplianceTaskStatus | null,
): ComplianceTaskStatus {
  if (currentStatus === "completed" || currentStatus === "not_applicable") {
    return currentStatus;
  }

  const today = isoDate(new Date());
  if (dueDate < today) {
    return "overdue";
  }

  const readyThreshold = startOfDay(today);
  readyThreshold.setUTCDate(readyThreshold.getUTCDate() + 14);

  return dueDate <= isoDate(readyThreshold) ? "ready" : "upcoming";
}

export function getAcademicYearDefaults(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    schoolYearLabel: `${startYear}-${endYear}`,
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-06-30`,
  };
}

export function inferComplianceGradeBand(gradeLevel?: string | null): ComplianceGradeBand {
  const normalized = safeText(gradeLevel ?? "");
  if (!normalized) {
    return "elementary";
  }

  if (/high|secondary|1[0-2]|9/.test(normalized.toLowerCase())) {
    return "secondary";
  }

  return "elementary";
}

function buildQuarterWindows(startDate: string, endDate: string) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const totalMs = Math.max(end.getTime() - start.getTime(), 0);
  const quarterMs = Math.max(Math.floor(totalMs / 4), 24 * 60 * 60 * 1000);

  return [0, 1, 2, 3].map((index) => {
    const windowStart = new Date(start.getTime() + quarterMs * index);
    const windowEnd =
      index === 3
        ? new Date(end)
        : new Date(Math.min(end.getTime(), start.getTime() + quarterMs * (index + 1)));

    if (index !== 3) {
      windowEnd.setUTCDate(windowEnd.getUTCDate() - 1);
    }

    return {
      label: `Q${index + 1} ${startDate.slice(0, 4)}-${endDate.slice(0, 4)}`,
      startDate: isoDate(windowStart),
      endDate: isoDate(windowEnd),
    };
  });
}

function resolveRequirementProfile(program: {
  jurisdictionCode: string;
  pathwayCode: string;
  requirementProfileVersion: string;
}) {
  return (
    getRequirementProfile({
      jurisdictionCode: program.jurisdictionCode,
      pathwayCode: program.pathwayCode,
      version: program.requirementProfileVersion,
    }) ?? getFallbackRequirementProfile()
  );
}

function buildGeneratedTasks(args: {
  program: typeof compliancePrograms.$inferSelect;
  profile: RequirementProfile;
}) {
  const generated: Array<{
    taskType: RequirementProfile["deadlineRules"][number]["taskType"];
    title: string;
    dueDate: string;
    notes: string | null;
    key: string;
  }> = [];

  for (const rule of args.profile.deadlineRules) {
    if (rule.kind === "offset_from_start") {
      const due = startOfDay(args.program.startDate);
      due.setUTCDate(due.getUTCDate() + rule.offsetDays);
      generated.push({
        taskType: rule.taskType,
        title: rule.title,
        dueDate: isoDate(due),
        notes: rule.notes ?? null,
        key: `${rule.taskType}:${rule.title}:${isoDate(due)}`,
      });
      continue;
    }

    if (rule.kind === "offset_from_end") {
      const due = startOfDay(args.program.endDate);
      due.setUTCDate(due.getUTCDate() + rule.offsetDays);
      generated.push({
        taskType: rule.taskType,
        title: rule.title,
        dueDate: isoDate(due),
        notes: rule.notes ?? null,
        key: `${rule.taskType}:${rule.title}:${isoDate(due)}`,
      });
      continue;
    }

    for (const quarter of buildQuarterWindows(args.program.startDate, args.program.endDate)) {
      generated.push({
        taskType: rule.taskType,
        title: `${rule.title} · ${quarter.label}`,
        dueDate: quarter.endDate,
        notes: rule.notes ?? null,
        key: `${rule.taskType}:${quarter.label}:${quarter.endDate}`,
      });
    }
  }

  return generated;
}

async function synchronizeProgramTasks(program: typeof compliancePrograms.$inferSelect) {
  const profile = resolveRequirementProfile(program);
  if (!profile) {
    return [];
  }

  const repos = createRepositories(getDb());
  const existing = await repos.compliance.listTasksForProgram(program.id);
  const existingByKey = new Map(
    existing.map((task) => [
      `${task.taskType}:${task.title}:${task.dueDate}`,
      task,
    ]),
  );
  const expected = buildGeneratedTasks({ program, profile });
  const expectedKeys = new Set(expected.map((task) => task.key));

  for (const task of expected) {
    const current = existingByKey.get(task.key);
    if (!current) {
      await repos.compliance.createTask({
        complianceProgramId: program.id,
        taskType: task.taskType,
        title: task.title,
        dueDate: task.dueDate,
        status: statusFromDueDate(task.dueDate),
        notes: task.notes,
        completionRefs: [],
        completedByAdultUserId: null,
        completedAt: null,
        metadata: {
          source: "profile_rule",
        },
      });
      continue;
    }

    await repos.compliance.updateTask(current.id, {
      notes: task.notes,
      status: statusFromDueDate(task.dueDate, current.status),
      metadata: {
        ...(current.metadata ?? {}),
        source: "profile_rule",
      },
    });
  }

  for (const task of existing) {
    const key = `${task.taskType}:${task.title}:${task.dueDate}`;
    if (expectedKeys.has(key) || task.status === "completed") {
      continue;
    }

    await repos.compliance.updateTask(task.id, {
      status: "not_applicable",
      metadata: {
        ...(task.metadata ?? {}),
        source: "profile_rule",
        retired: true,
      },
    });
  }

  return repos.compliance.listTasksForProgram(program.id);
}

export async function ensureComplianceProgramForLearner(params: {
  organizationId: string;
  learnerId: string;
  gradeLevel?: string | null;
  schoolYearLabel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  jurisdictionCode?: string | null;
  pathwayCode?: string | null;
  status?: ComplianceProgramStatus;
}) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const existing = await repos.compliance.findActiveProgramForLearner(params.learnerId);
  if (existing) {
    return existing;
  }

  const fallbackProfile = getFallbackRequirementProfile();
  if (!fallbackProfile) {
    throw new Error("No compliance requirement profiles are configured.");
  }

  const defaults = getAcademicYearDefaults();
  const schoolYearLabel = optionalNonEmptyString(params.schoolYearLabel) ?? defaults.schoolYearLabel;
  const startDate = optionalIsoDate(params.startDate) ?? defaults.startDate;
  const endDate = optionalIsoDate(params.endDate) ?? defaults.endDate;
  const program = await repos.compliance.createProgram({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    schoolYearLabel,
    startDate,
    endDate,
    jurisdictionCode: params.jurisdictionCode ?? fallbackProfile.jurisdictionCode,
    pathwayCode: params.pathwayCode ?? fallbackProfile.pathwayCode,
    requirementProfileVersion: fallbackProfile.version,
    gradeBand: inferComplianceGradeBand(params.gradeLevel),
    status: params.status ?? "active",
    metadata: {
      source: "auto_initialized",
    },
  });

  await synchronizeProgramTasks(program);
  return program;
}

export async function ensureComplianceProgramFromHouseholdDefaults(params: {
  organizationId: string;
  learnerId: string;
  gradeLevel?: string | null;
}) {
  const householdPreferences = await getHomeschoolHouseholdPreferences(params.organizationId);
  return ensureComplianceProgramForLearner({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    gradeLevel: params.gradeLevel,
    schoolYearLabel: householdPreferences.schoolYearLabel,
    startDate: householdPreferences.termStartDate,
    endDate: householdPreferences.termEndDate,
  });
}

export async function upsertComplianceProgram(params: {
  organizationId: string;
  learnerId: string;
  schoolYearLabel: string;
  startDate: string;
  endDate: string;
  jurisdictionCode: string;
  pathwayCode: string;
  gradeBand: ComplianceGradeBand;
  status?: ComplianceProgramStatus;
}) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const profile =
    getRequirementProfile({
      jurisdictionCode: params.jurisdictionCode,
      pathwayCode: params.pathwayCode,
    }) ?? getFallbackRequirementProfile();

  if (!profile) {
    throw new Error("Choose a requirement profile first.");
  }

  const current =
    (await repos.compliance.findActiveProgramForLearner(params.learnerId)) ??
    (await repos.compliance.findLatestProgramForLearner(params.learnerId));

  const nextDefinition: ComplianceProgramDefinition = {
    schoolYearLabel: params.schoolYearLabel,
    startDate: params.startDate,
    endDate: params.endDate,
    jurisdictionCode: params.jurisdictionCode,
    pathwayCode: params.pathwayCode,
    requirementProfileVersion: profile.version,
    gradeBand: params.gradeBand,
    status: params.status ?? "active",
  };

  const program = current
    ? await repos.compliance.updateProgram(current.id, {
        ...nextDefinition,
        metadata: {
          ...(current.metadata ?? {}),
          source: "settings_update",
        },
      })
    : await repos.compliance.createProgram({
        organizationId: params.organizationId,
        learnerId: params.learnerId,
        ...nextDefinition,
        metadata: {
          source: "settings_create",
        },
      });

  if (!program) {
    throw new Error("Could not save the compliance program.");
  }

  await synchronizeProgramTasks(program);
  return program;
}

export async function getLearnerComplianceProgram(params: {
  organizationId: string;
  learnerId: string;
}) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const current =
    (await repos.compliance.findActiveProgramForLearner(params.learnerId)) ??
    (await repos.compliance.findLatestProgramForLearner(params.learnerId));

  if (current) {
    return current;
  }

  const profile = await getDb().query.learnerProfiles.findFirst({
    where: eq(learnerProfiles.learnerId, params.learnerId),
  });

  return ensureComplianceProgramFromHouseholdDefaults({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    gradeLevel: profile?.gradeLevel ?? null,
  });
}

export async function listComplianceTasksForProgram(complianceProgramId: string) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const tasks = await repos.compliance.listTasksForProgram(complianceProgramId);
  return tasks.map<ComplianceTaskSummary>((task) => ({
    id: task.id,
    taskType: task.taskType,
    title: task.title,
    dueDate: task.dueDate,
    status: statusFromDueDate(task.dueDate, task.status),
    notes: task.notes ?? null,
    completionRefs: asStringArray(task.completionRefs),
  }));
}

export async function updateComplianceTaskState(params: {
  taskId: string;
  status: ComplianceTaskStatus;
  completionRef?: string | null;
}) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const db = getDb();
  const task = await db.query.complianceTasks.findFirst({
    where: eq(complianceTasks.id, params.taskId),
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  const completionRefs = new Set(asStringArray(task.completionRefs));
  if (params.completionRef) {
    completionRefs.add(params.completionRef);
  }

  const updated = await repos.compliance.updateTask(task.id, {
    status: params.status,
    completionRefs: [...completionRefs],
    completedAt: params.status === "completed" ? new Date() : null,
  });

  if (!updated) {
    throw new Error("Could not update that task.");
  }

  return updated;
}

export async function saveEvidenceToPortfolio(params: {
  organizationId: string;
  learnerId: string;
  evidenceId: string;
  complianceProgramId: string;
  status?: PortfolioEntryStatus;
  artifactKind?: PortfolioArtifactKind | null;
  subjectKey?: string | null;
  periodLabel?: string | null;
}) {
  await ensureDatabaseReady();
  const db = getDb();
  const record = await db.query.evidenceRecords.findFirst({
    where: and(
      eq(evidenceRecords.id, params.evidenceId),
      eq(evidenceRecords.organizationId, params.organizationId),
      eq(evidenceRecords.learnerId, params.learnerId),
    ),
  });

  if (!record) {
    throw new Error("Evidence record not found.");
  }

  const [updated] = await db
    .update(evidenceRecords)
    .set({
      complianceProgramId: params.complianceProgramId,
      portfolioStatus: params.status ?? "saved",
      portfolioArtifactKind: params.artifactKind ?? record.portfolioArtifactKind ?? "work_sample",
      portfolioSubjectKey: params.subjectKey ?? record.portfolioSubjectKey ?? null,
      portfolioPeriodLabel: params.periodLabel ?? record.portfolioPeriodLabel ?? null,
      updatedAt: new Date(),
    })
    .where(eq(evidenceRecords.id, record.id))
    .returning();

  if (!updated) {
    throw new Error("Could not update that portfolio item.");
  }

  return updated;
}

export async function saveSessionEvidenceToPortfolio(params: {
  organizationId: string;
  learnerId: string;
  lessonSessionId: string;
  complianceProgramId: string;
  artifactKind?: PortfolioArtifactKind | null;
}) {
  await ensureDatabaseReady();
  const db = getDb();
  const record = await db.query.evidenceRecords.findFirst({
    where: and(
      eq(evidenceRecords.organizationId, params.organizationId),
      eq(evidenceRecords.learnerId, params.learnerId),
      eq(evidenceRecords.lessonSessionId, params.lessonSessionId),
    ),
    orderBy: [desc(evidenceRecords.capturedAt), desc(evidenceRecords.createdAt)],
  });

  if (!record) {
    throw new Error("Save a lesson outcome first so there is evidence to add.");
  }

  const plan = record.planItemId
    ? await db.query.planItems.findFirst({
        where: eq(planItems.id, record.planItemId),
      })
    : null;

  return saveEvidenceToPortfolio({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    evidenceId: record.id,
    complianceProgramId: params.complianceProgramId,
    artifactKind: params.artifactKind ?? "work_sample",
    subjectKey: plan?.subject ?? null,
  });
}

export async function createManualPortfolioArtifact(params: {
  organizationId: string;
  learnerId: string;
  complianceProgramId: string;
  title: string;
  note?: string | null;
  subjectKey?: string | null;
  periodLabel?: string | null;
  artifactKind: PortfolioArtifactKind;
  file?: File | null;
}) {
  await ensureDatabaseReady();
  const db = getDb();
  let storagePath: string | null = null;
  let evidenceType: "note" | "file_upload" | "photo" = "note";

  if (params.file) {
    const buffer = Buffer.from(await params.file.arrayBuffer());
    const fileName = sanitizeFileName(params.file.name);
    storagePath = buildLearnerStoragePath(
      params.organizationId,
      params.learnerId,
      "portfolio",
      params.complianceProgramId,
      fileName,
    );

    const storage = getAdminStorageClient().from(storageBuckets.learnerUploads);
    const upload = await storage.upload(storagePath, buffer, {
      cacheControl: "3600",
      contentType: params.file.type || undefined,
      upsert: true,
    });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    evidenceType = params.file.type.startsWith("image/") ? "photo" : "file_upload";
  }

  const [record] = await db
    .insert(evidenceRecords)
    .values({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      complianceProgramId: params.complianceProgramId,
      lessonSessionId: null,
      planItemId: null,
      activityAttemptId: null,
      progressRecordId: null,
      artifactId: null,
      evidenceType,
      reviewState: "submitted",
      title: params.title.trim(),
      body: params.note?.trim() || null,
      storagePath,
      audience: "shared",
      portfolioStatus: "saved",
      portfolioArtifactKind: params.artifactKind,
      portfolioSubjectKey: params.subjectKey?.trim() || null,
      portfolioPeriodLabel: params.periodLabel?.trim() || null,
      createdByAdultUserId: null,
      metadata: {
        source: params.file ? "manual_upload" : "manual_note",
        fileName: params.file?.name ?? null,
      },
    })
    .returning();

  return record;
}

export async function upsertProgressSnapshot(params: {
  complianceProgramId: string;
  periodType: CompliancePeriodType;
  periodLabel: string;
  summaryText: string;
  strengths: string;
  struggles: string;
  nextSteps: string;
  subjectNotes: Array<{ subject: string; note: string }>;
  evidenceRefs: string[];
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  status?: ComplianceSnapshotStatus;
}) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const existing = (
    await repos.compliance.listSnapshotsForProgram(params.complianceProgramId)
  ).find(
    (snapshot) =>
      snapshot.periodType === params.periodType && snapshot.periodLabel === params.periodLabel,
  );

  if (existing) {
    return repos.compliance.updateSnapshot(existing.id, {
      summaryText: params.summaryText,
      strengths: params.strengths,
      struggles: params.struggles,
      nextSteps: params.nextSteps,
      subjectNotes: params.subjectNotes,
      evidenceRefs: params.evidenceRefs,
      periodStartDate: params.periodStartDate ?? existing.periodStartDate,
      periodEndDate: params.periodEndDate ?? existing.periodEndDate,
      status: params.status ?? existing.status,
    });
  }

  return repos.compliance.createSnapshot({
    complianceProgramId: params.complianceProgramId,
    periodType: params.periodType,
    periodLabel: params.periodLabel,
    periodStartDate: params.periodStartDate ?? null,
    periodEndDate: params.periodEndDate ?? null,
    summaryText: params.summaryText,
    strengths: params.strengths,
    struggles: params.struggles,
    nextSteps: params.nextSteps,
    subjectNotes: params.subjectNotes,
    evidenceRefs: params.evidenceRefs,
    status: params.status ?? "draft",
    metadata: {
      source: "manual_or_generated",
    },
  });
}

export async function listProgressSnapshotsForProgram(complianceProgramId: string) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const snapshots = await repos.compliance.listSnapshotsForProgram(complianceProgramId);
  return snapshots.map<ProgressSnapshotSummary>((snapshot) => ({
    id: snapshot.id,
    periodType: snapshot.periodType,
    periodLabel: snapshot.periodLabel,
    summaryText: snapshot.summaryText,
    strengths: snapshot.strengths,
    struggles: snapshot.struggles,
    nextSteps: snapshot.nextSteps,
    subjectNotes: Array.isArray(snapshot.subjectNotes) ? snapshot.subjectNotes : [],
    evidenceRefs: asStringArray(snapshot.evidenceRefs),
    status: snapshot.status,
  }));
}

export async function saveComplianceEvaluationRecord(params: {
  complianceProgramId: string;
  evaluationType: "parent_summary" | "teacher_letter" | "standardized_test" | "portfolio_review" | "external_assessment";
  resultSummary: string;
  evaluatorName?: string | null;
  evaluatorRole?: string | null;
  status?: "draft" | "completed" | "waived" | "not_applicable";
}) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  return repos.compliance.createEvaluationRecord({
    complianceProgramId: params.complianceProgramId,
    evaluationType: params.evaluationType,
    completedAt: params.status === "completed" ? new Date() : null,
    resultSummary: params.resultSummary,
    documentRefs: [],
    evaluatorName: params.evaluatorName ?? null,
    evaluatorRole: params.evaluatorRole ?? null,
    status: params.status ?? "completed",
    metadata: {
      source: "manual_entry",
    },
  });
}

export async function saveComplianceReportDraft(params: {
  complianceProgramId: string;
  reportKind: ComplianceReportKind;
  periodLabel: string;
  title: string;
  content: string;
  status?: "draft" | "final";
}) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const existing = (
    await repos.compliance.listReportDraftsForProgram(params.complianceProgramId)
  ).find(
    (draft) =>
      draft.reportKind === params.reportKind && draft.periodLabel === params.periodLabel,
  );

  if (existing) {
    return repos.compliance.updateReportDraft(existing.id, {
      title: params.title,
      content: params.content,
      status: params.status ?? existing.status,
    });
  }

  return repos.compliance.createReportDraft({
    complianceProgramId: params.complianceProgramId,
    reportKind: params.reportKind,
    periodLabel: params.periodLabel,
    title: params.title,
    content: params.content,
    status: params.status ?? "draft",
    metadata: {
      source: "generated_shell",
    },
  });
}

export async function listComplianceReportDrafts(complianceProgramId: string) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const drafts = await repos.compliance.listReportDraftsForProgram(complianceProgramId);
  return drafts.map<ComplianceReportDraftSummary>((draft) => ({
    id: draft.id,
    reportKind: draft.reportKind,
    title: draft.title,
    periodLabel: draft.periodLabel,
    status: draft.status,
    content: draft.content,
    exportFileName: `${draft.reportKind}-${draft.periodLabel}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase(),
  }));
}

export async function listAttendanceLedger(params: {
  organizationId: string;
  learnerId: string;
  startDate: string;
  endDate: string;
}) {
  await ensureDatabaseReady();
  const db = getDb();
  const rows = await db.query.homeschoolAttendanceRecords.findMany({
    where: and(
      eq(homeschoolAttendanceRecords.organizationId, params.organizationId),
      eq(homeschoolAttendanceRecords.learnerId, params.learnerId),
    ),
    orderBy: [desc(homeschoolAttendanceRecords.attendanceDate)],
  });

  return rows
    .filter(
      (row) => row.attendanceDate >= params.startDate && row.attendanceDate <= params.endDate,
    )
    .map<AttendanceLedgerEntry>((row) => ({
      id: row.id,
      date: row.attendanceDate,
      status: row.status,
      instructionalMinutes: row.minutes ?? 0,
      source: row.source as ComplianceAttendanceSource,
      note: row.note ?? null,
      derivedSessionIds: asStringArray(row.derivedSessionIds),
      isSuggested: row.source === "derived_from_sessions",
    }));
}

export function summarizeAttendanceProgress(params: {
  profile: RequirementProfile | null;
  gradeBand: ComplianceGradeBand;
  records: AttendanceLedgerEntry[];
}): AttendanceProgressSummary {
  const instructionalRows = params.records.filter(
    (record) =>
      record.status === "present" ||
      record.status === "partial" ||
      record.status === "field_trip",
  );
  const loggedInstructionalDays = instructionalRows.filter(
    (record) => record.status !== "partial" || record.instructionalMinutes > 0,
  ).length;
  const nonInstructionalDays = params.records.filter(
    (record) =>
      record.status === "holiday" ||
      record.status === "non_instructional" ||
      record.status === "absent" ||
      record.status === "excused",
  ).length;
  const instructionalMinutes = instructionalRows.reduce(
    (total, record) => total + record.instructionalMinutes,
    0,
  );
  const instructionalHours = Math.round((instructionalMinutes / 60) * 10) / 10;
  const targetDays = params.profile?.attendanceTargetDays ?? null;
  const targetHours =
    params.profile?.attendanceMode === "hours" || params.profile?.attendanceMode === "days_or_hours"
      ? params.gradeBand === "secondary"
        ? params.profile.attendanceTargetHoursSecondary ?? null
        : params.profile.attendanceTargetHoursElementary ?? null
      : null;

  const progressLabel =
    targetHours != null
      ? `${instructionalHours}/${targetHours} instructional hours`
      : targetDays != null
        ? `${loggedInstructionalDays}/${targetDays} instructional days`
        : `${loggedInstructionalDays} logged days`;

  const readinessLabel =
    targetHours != null && instructionalHours >= targetHours
      ? "Hours target met"
      : targetDays != null && loggedInstructionalDays >= targetDays
        ? "Days target met"
        : params.profile?.attendanceMode === "minimal"
          ? "Recordkeeping only"
          : "Still building";

  return {
    loggedInstructionalDays,
    instructionalHours,
    nonInstructionalDays,
    targetDays,
    targetHours,
    progressLabel,
    readinessLabel,
  };
}

export function getRequirementProfileSummary(program: typeof compliancePrograms.$inferSelect | null) {
  if (!program) {
    return null;
  }

  return resolveRequirementProfile(program);
}

export function getRequirementProfileOptions() {
  return listRequirementProfiles();
}
