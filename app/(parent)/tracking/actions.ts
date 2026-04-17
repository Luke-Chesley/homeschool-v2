"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import {
  createManualPortfolioArtifact,
  getLearnerComplianceProgram,
  saveComplianceEvaluationRecord,
  saveComplianceReportDraft,
  saveEvidenceToPortfolio,
  updateComplianceTaskState,
  upsertComplianceProgram,
} from "@/lib/compliance/service";
import type { ComplianceGradeBand, PortfolioArtifactKind } from "@/lib/compliance/types";
import { recordHomeschoolAuditEvent } from "@/lib/homeschool/reporting/service";
import { trackProductEvent } from "@/lib/platform/observability";
import { updateRecommendationDecision } from "@/lib/tracking/service";

const ComplianceProgramSchema = z.object({
  schoolYearLabel: z.string().trim().min(1).max(80),
  startDate: z.string().trim().min(1).max(20),
  endDate: z.string().trim().min(1).max(20),
  jurisdictionCode: z.string().trim().min(1).max(40),
  pathwayCode: z.string().trim().min(1).max(80),
  gradeBand: z.enum(["elementary", "secondary"]),
});

function revalidateTrackingPaths() {
  revalidatePath("/tracking");
  revalidatePath("/tracking/reports");
  revalidatePath("/account");
}

export async function applyTrackingRecommendationAction(formData: FormData) {
  const session = await requireAppSession();
  const recommendationId = formData.get("recommendationId");
  const action = formData.get("action");

  if (
    typeof recommendationId !== "string" ||
    (action !== "accept" && action !== "override")
  ) {
    return;
  }

  await updateRecommendationDecision({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    recommendationId,
    action,
  });

  revalidateTrackingPaths();
}

export async function upsertTrackingComplianceProgramAction(input: {
  schoolYearLabel: string;
  startDate: string;
  endDate: string;
  jurisdictionCode: string;
  pathwayCode: string;
  gradeBand: ComplianceGradeBand;
}) {
  const parsed = ComplianceProgramSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Complete the school year, dates, profile, and grade band before saving.",
    };
  }

  const session = await requireAppSession();
  const program = await upsertComplianceProgram({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    ...parsed.data,
  });

  await recordHomeschoolAuditEvent({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    entityType: "preference",
    entityId: program.id,
    eventType: "compliance.program_saved",
    summary: `Updated the tracking setup for ${session.activeLearner.displayName}.`,
    metadata: parsed.data,
  });
  await trackProductEvent({
    name: "compliance_program_saved",
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    metadata: parsed.data,
  });

  revalidateTrackingPaths();
  return {
    ok: true,
    programId: program.id,
  };
}

export async function savePortfolioEvidenceAction(input: {
  evidenceId: string;
  status?: "saved" | "archived" | "inbox";
  artifactKind?: PortfolioArtifactKind | null;
  subjectKey?: string | null;
  periodLabel?: string | null;
}) {
  const session = await requireAppSession();
  const program = await getLearnerComplianceProgram({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
  });

  const record = await saveEvidenceToPortfolio({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    evidenceId: input.evidenceId,
    complianceProgramId: program.id,
    status: input.status,
    artifactKind: input.artifactKind ?? null,
    subjectKey: input.subjectKey ?? null,
    periodLabel: input.periodLabel ?? null,
  });

  await recordHomeschoolAuditEvent({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    entityType: "report",
    entityId: record.id,
    eventType: "compliance.portfolio_saved",
    summary: `Saved evidence "${record.title}" to the portfolio.`,
    metadata: {
      evidenceId: record.id,
      status: record.portfolioStatus,
    },
  });
  await trackProductEvent({
    name: "compliance_portfolio_saved",
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    metadata: {
      evidenceId: record.id,
      status: record.portfolioStatus,
    },
  });

  revalidateTrackingPaths();
  return { ok: true, recordId: record.id, status: record.portfolioStatus };
}

export async function uploadPortfolioArtifactAction(formData: FormData) {
  const session = await requireAppSession();
  const title = formData.get("title");
  const note = formData.get("note");
  const artifactKind = formData.get("artifactKind");
  const subjectKey = formData.get("subjectKey");
  const periodLabel = formData.get("periodLabel");
  const file = formData.get("file");

  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, error: "Add a title for the portfolio item." };
  }

  if (
    artifactKind !== "work_sample" &&
    artifactKind !== "photo" &&
    artifactKind !== "pdf" &&
    artifactKind !== "test_result" &&
    artifactKind !== "evaluator_letter" &&
    artifactKind !== "report_card" &&
    artifactKind !== "reading_log_export" &&
    artifactKind !== "checklist_attachment" &&
    artifactKind !== "note" &&
    artifactKind !== "other"
  ) {
    return { ok: false, error: "Choose the kind of portfolio item you are saving." };
  }

  const program = await getLearnerComplianceProgram({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
  });

  const record = await createManualPortfolioArtifact({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    complianceProgramId: program.id,
    title,
    note: typeof note === "string" ? note : null,
    subjectKey: typeof subjectKey === "string" ? subjectKey : null,
    periodLabel: typeof periodLabel === "string" ? periodLabel : null,
    artifactKind,
    file: file instanceof File && file.size > 0 ? file : null,
  });

  await recordHomeschoolAuditEvent({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    entityType: "report",
    entityId: record.id,
    eventType: "compliance.portfolio_uploaded",
    summary: `Added "${record.title}" to the portfolio.`,
    metadata: {
      evidenceId: record.id,
      artifactKind,
    },
  });

  revalidateTrackingPaths();
  return { ok: true, recordId: record.id };
}

export async function updateComplianceTaskAction(input: {
  taskId: string;
  status: "completed" | "not_applicable" | "ready";
}) {
  const session = await requireAppSession();
  const task = await updateComplianceTaskState({
    taskId: input.taskId,
    status: input.status,
  });

  await recordHomeschoolAuditEvent({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    entityType: "report",
    entityId: task.id,
    eventType: "compliance.task_updated",
    summary: `Updated compliance task "${task.title}" to ${task.status}.`,
    metadata: {
      taskId: task.id,
      status: task.status,
    },
  });

  revalidateTrackingPaths();
  return { ok: true };
}

export async function saveComplianceEvaluationAction(input: {
  evaluationType:
    | "parent_summary"
    | "teacher_letter"
    | "standardized_test"
    | "portfolio_review"
    | "external_assessment";
  resultSummary: string;
  evaluatorName?: string | null;
  evaluatorRole?: string | null;
  status?: "draft" | "completed" | "waived" | "not_applicable";
}) {
  if (!input.resultSummary.trim()) {
    return { ok: false, error: "Add a short evaluation summary first." };
  }

  const session = await requireAppSession();
  const program = await getLearnerComplianceProgram({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
  });

  const record = await saveComplianceEvaluationRecord({
    complianceProgramId: program.id,
    evaluationType: input.evaluationType,
    resultSummary: input.resultSummary.trim(),
    evaluatorName: input.evaluatorName ?? null,
    evaluatorRole: input.evaluatorRole ?? null,
    status: input.status ?? "completed",
  });

  await recordHomeschoolAuditEvent({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    entityType: "report",
    entityId: record.id,
    eventType: "compliance.evaluation_saved",
    summary: `Saved an evaluation record for ${session.activeLearner.displayName}.`,
    metadata: {
      evaluationType: record.evaluationType,
      status: record.status,
    },
  });

  revalidateTrackingPaths();
  return { ok: true, recordId: record.id };
}

export async function saveComplianceReportDraftAction(input: {
  reportKind:
    | "attendance_summary"
    | "quarterly_report"
    | "annual_summary"
    | "evaluation_packet"
    | "portfolio_checklist"
    | "transcript_skeleton";
  periodLabel: string;
  title: string;
  content: string;
  status?: "draft" | "final";
}) {
  if (!input.title.trim() || !input.content.trim()) {
    return { ok: false, error: "Add a title and report content before saving." };
  }

  const session = await requireAppSession();
  const program = await getLearnerComplianceProgram({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
  });

  const draft = await saveComplianceReportDraft({
    complianceProgramId: program.id,
    reportKind: input.reportKind,
    periodLabel: input.periodLabel,
    title: input.title.trim(),
    content: input.content.trim(),
    status: input.status ?? "draft",
  });

  await recordHomeschoolAuditEvent({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    entityType: "report",
    entityId: draft?.id ?? null,
    eventType: "compliance.report_saved",
    summary: `Saved ${input.reportKind.replaceAll("_", " ")} draft.`,
    metadata: {
      reportKind: input.reportKind,
      status: input.status ?? "draft",
    },
  });

  revalidateTrackingPaths();
  return { ok: true, draftId: draft?.id ?? null };
}
