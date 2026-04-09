import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { getRepositories } from "@/lib/db";
import {
  buildTodayLessonDraftFingerprint,
  getTodayWorkspace,
  saveTodayLessonDraft,
} from "@/lib/planning/today-service";
import { executeSessionGenerate, previewSessionGenerate } from "@/lib/learning-core/session";

const RequestSchema = z.object({
  date: z.string().optional(),
  debug: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const session = await requireAppSession();
  const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
  const workspaceResult = await getTodayWorkspace({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    date,
  });

  if (!workspaceResult || workspaceResult.workspace.items.length === 0) {
    return NextResponse.json(
      { error: "No route items available for lesson plan generation." },
      { status: 409 },
    );
  }

  const { workspace, sourceTitle, planningContext, sessionTiming } = workspaceResult;

  // Use the canonical session budget from curriculum pacing.
  // Do NOT sum workspace.items[*].estimatedMinutes — those are per-item effort
  // hints and summing them inflates the lesson budget when multiple items are present.
  const resolvedTiming = {
    resolvedTotalMinutes: sessionTiming.resolvedTotalMinutes,
    sourceSessionMinutes: sessionTiming.sourceSessionMinutes,
    lessonOverrideMinutes: sessionTiming.lessonOverrideMinutes,
    timingSource: sessionTiming.timingSource,
  };

  const lessonDraftInput = {
    title: sourceTitle,
    topic: workspace.leadItem.title,
    resolvedTiming,
    objectives: workspace.sessionTargets,
    routeItems: workspace.items.map((item) => ({
      title: item.title,
      subject: item.subject,
      estimatedMinutes: item.estimatedMinutes,
      objective: item.objective,
      lessonLabel: item.lessonLabel,
      note: item.note,
    })),
    materials: workspace.items.flatMap((item) => item.materials).slice(0, 8),
    context: {
      learnerId: workspace.learner.id,
      learnerName: workspace.learner.name,
      curriculumSourceId: workspaceResult.sourceId,
      lessonId: workspace.leadItem.curriculum?.weeklyRouteItemId,
      standardIds: workspace.items.flatMap((item) => item.standards),
      goalIds: workspace.items.flatMap((item) => item.goals),
      curriculumSnapshot: planningContext?.curriculumSnapshot,
      weeklyPlanningSnapshot: planningContext?.weeklyPlanningSnapshot,
      feedbackNotes: planningContext?.feedbackNotes ?? [],
      recentOutcomes: [],
      dailyWorkspaceSnapshot: {
        date: workspace.date,
        headline: workspace.headline,
        leadLesson: {
          title: workspace.leadItem.title,
          subject: workspace.leadItem.subject,
          objective: workspace.leadItem.objective,
          lessonLabel: workspace.leadItem.lessonLabel,
          estimatedMinutes: workspace.leadItem.estimatedMinutes,
        },
        planItems: workspace.items.map((item) => ({
          title: item.title,
          subject: item.subject,
          objective: item.objective,
          lessonLabel: item.lessonLabel,
          status: item.status,
          estimatedMinutes: item.estimatedMinutes,
          materials: item.materials,
          copilotPrompts: item.copilotPrompts,
        })),
        prepChecklist: workspace.prepChecklist,
        sessionTargets: workspace.sessionTargets,
        copilotInsertions: workspace.copilotInsertions,
        completionPrompts: workspace.completionPrompts,
        familyNotes: workspace.familyNotes,
      },
    },
  };

  if (parsed.data.debug) {
    const promptPreview = await previewSessionGenerate({
      input: lessonDraftInput,
      surface: "planning",
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      planItemIds: workspace.items.map((item) => item.id),
    });

    return NextResponse.json({
      sourceTitle,
      date,
      debug: promptPreview,
    });
  }

  const result = await executeSessionGenerate({
    input: lessonDraftInput,
    surface: "planning",
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    planItemIds: workspace.items.map((item) => item.id),
  });
  const routeFingerprint = buildTodayLessonDraftFingerprint(workspace.items.map((item) => item.id));
  const artifact = await getRepositories().activities.createArtifact({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    planItemId: null,
    lessonSessionId: null,
    artifactType: "lesson_plan",
    title: `${sourceTitle} lesson draft`,
    status: "ready",
    body: JSON.stringify(result.artifact),
    promptVersion: result.lineage.skill_version,
    promptTemplateId: null,
    generationJobId: null,
    storagePath: null,
    providerId: result.lineage.provider,
    modelId: result.lineage.model,
    inputHash: null,
    lineageParentId: null,
    supersededByArtifactId: null,
    approvedAt: null,
    archivedAt: null,
    sourceContext: {
      date,
      sourceId: workspaceResult.sourceId,
      routeFingerprint,
      schemaVersion: result.artifact.schema_version,
    },
    qaMetadata: {
      requestId: result.trace.request_id,
    },
    costMetadata: {},
    metadata: {
      routeItemIds: workspace.items.map((item) => item.id),
    },
  });
  const savedDraft = await saveTodayLessonDraft({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    date,
    sourceId: workspaceResult.sourceId,
    sourceTitle,
    routeFingerprint,
    structured: result.artifact,
    promptVersion: result.lineage.skill_version,
  });

  return NextResponse.json({
    structured: savedDraft.structured,
    promptVersion: savedDraft.promptVersion,
    artifactId: artifact.id,
    sourceTitle,
    date,
    summary: {
      itemCount: workspace.items.length,
      totalMinutes: sessionTiming.resolvedTotalMinutes,
      timingSource: sessionTiming.timingSource,
      objectiveCount: workspace.sessionTargets.length,
      weekLabel: planningContext?.weeklyPlanningSnapshot?.weekLabel,
      weekHighlights: planningContext?.weeklyPlanningSnapshot?.highlights ?? [],
    },
    lineage: result.lineage,
    trace: result.trace,
  });
}
