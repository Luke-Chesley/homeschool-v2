import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { getRepositories } from "@/lib/db";
import {
  buildTodayLessonDraftFingerprint,
  getTodayWorkspace,
  saveTodayLessonDraft,
} from "@/lib/planning/today-service";
import { buildLessonDraftPromptPreview, generateLessonDraft } from "@/lib/ai/task-service";

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

  const { workspace, sourceTitle, planningContext } = workspaceResult;
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  const lessonDraftInput = {
    title: sourceTitle,
    topic: workspace.leadItem.title,
    estimatedMinutes: totalMinutes,
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
    const promptPreview = await buildLessonDraftPromptPreview(lessonDraftInput);

    return NextResponse.json({
      promptVersion: "preview",
      sourceTitle,
      date,
      debug: promptPreview,
    });
  }

  const result = await generateLessonDraft(lessonDraftInput);
  const routeFingerprint = buildTodayLessonDraftFingerprint(workspace.items.map((item) => item.id));
  const artifact = await getRepositories().activities.createArtifact({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    planItemId: null,
    lessonSessionId: null,
    artifactType: "lesson_plan",
    title: `${sourceTitle} lesson draft`,
    status: "ready",
    // Store structured draft as JSON string in the body field
    body: JSON.stringify(result.output),
    promptVersion: result.lineage.promptRef.version,
    promptTemplateId: null,
    generationJobId: null,
    storagePath: null,
    providerId: result.lineage.providerId,
    modelId: result.lineage.modelId,
    inputHash: result.lineage.inputHash,
    lineageParentId: null,
    supersededByArtifactId: null,
    approvedAt: null,
    archivedAt: null,
    sourceContext: {
      date,
      sourceId: workspaceResult.sourceId,
      routeFingerprint,
      schemaVersion: result.output.schema_version,
    },
    qaMetadata: {
      lineageId: result.lineage.id,
    },
    costMetadata: result.usage ?? {},
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
    structured: result.output,
    promptVersion: result.lineage.promptRef.version,
  });

  return NextResponse.json({
    structured: savedDraft.structured,
    promptVersion: savedDraft.promptVersion,
    artifactId: artifact.id,
    sourceTitle,
    date,
    summary: {
      itemCount: workspace.items.length,
      totalMinutes,
      objectiveCount: workspace.sessionTargets.length,
      weekLabel: planningContext?.weeklyPlanningSnapshot?.weekLabel,
      weekHighlights: planningContext?.weeklyPlanningSnapshot?.highlights ?? [],
    },
  });
}
