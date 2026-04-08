/**
 * POST /api/ai/generate
 *
 * Dispatches a long-running AI generation job (Inngest async).
 * Returns immediately with a job ID; the caller polls for completion.
 *
 * Integration point: when Inngest is configured, the job is dispatched via
 * inngest.send("ai/generation.requested", ...). Until then, this runs the
 * mock adapter inline.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AiTaskNameSchema } from "@/lib/ai/types";
import { requireAppSession } from "@/lib/app-session/server";
import {
  dispatchCurriculumGeneration,
  dispatchLessonDraft,
  dispatchWorksheetGeneration,
  dispatchInteractiveGeneration,
  dispatchPlanAdaptation,
} from "@/lib/ai/task-service";

const RequestSchema = z.object({
  taskName: AiTaskNameSchema,
  inputs: z.record(z.string(), z.unknown()),
  context: z
    .object({
      learnerId: z.string().optional(),
      learnerName: z.string().optional(),
      curriculumSourceId: z.string().optional(),
      lessonId: z.string().optional(),
      standardIds: z.array(z.string()).default([]),
      goalIds: z.array(z.string()).default([]),
      recentOutcomes: z.array(z.unknown()).default([]),
    })
    .optional(),
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

  const { taskName, inputs } = parsed.data;
  const session = await requireAppSession();
  const dispatchContext = {
    organizationId: session.organization.id,
    learnerId: parsed.data.context?.learnerId ?? session.activeLearner.id,
    lessonSessionId: parsed.data.context?.lessonId ?? null,
  };

  try {
    let job;
    switch (taskName) {
      case "curriculum.generate":
        job = await dispatchCurriculumGeneration(
          inputs as unknown as Parameters<typeof dispatchCurriculumGeneration>[0],
          dispatchContext,
        );
        break;
      case "lesson.draft":
        job = await dispatchLessonDraft(
          inputs as unknown as Parameters<typeof dispatchLessonDraft>[0],
          dispatchContext,
        );
        break;
      case "worksheet.generate":
        job = await dispatchWorksheetGeneration(
          inputs as unknown as Parameters<typeof dispatchWorksheetGeneration>[0],
          dispatchContext,
        );
        break;
      case "interactive.generate":
        job = await dispatchInteractiveGeneration(
          inputs as unknown as Parameters<typeof dispatchInteractiveGeneration>[0],
          dispatchContext,
        );
        break;
      case "plan.adapt":
        job = await dispatchPlanAdaptation(
          inputs as unknown as Parameters<typeof dispatchPlanAdaptation>[0],
          dispatchContext,
        );
        break;
      default:
        return NextResponse.json(
          { error: `Task "${taskName}" cannot be dispatched as an async job` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      jobId: job.jobId,
      taskName: job.taskName,
      artifactId: job.artifactId ?? null,
      status: "queued",
    });
  } catch (err) {
    console.error("[api/ai/generate POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
