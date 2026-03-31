import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import { generateLessonDraft } from "@/lib/ai/task-service";

const RequestSchema = z.object({
  date: z.string().optional(),
  sourceId: z.string().optional(),
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
    sourceId: parsed.data.sourceId,
  });

  if (!workspaceResult || workspaceResult.workspace.items.length === 0) {
    return NextResponse.json(
      { error: "No route items available for lesson plan generation." },
      { status: 409 },
    );
  }

  const { workspace, sourceTitle } = workspaceResult;
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  const result = await generateLessonDraft({
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
      curriculumSourceId: workspace.items[0]?.curriculum?.sourceId ?? parsed.data.sourceId,
      lessonId: workspace.leadItem.curriculum?.weeklyRouteItemId,
      standardIds: workspace.items.flatMap((item) => item.standards),
      goalIds: workspace.items.flatMap((item) => item.goals),
      feedbackNotes: [],
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
  });

  return NextResponse.json({
    markdown: result.output,
    promptVersion: result.lineage.promptRef.version,
    sourceTitle,
    date,
    summary: {
      itemCount: workspace.items.length,
      totalMinutes,
      objectiveCount: workspace.sessionTargets.length,
    },
  });
}
