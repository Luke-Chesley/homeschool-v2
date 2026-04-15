import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { generateTodayLessonDraft, previewTodayLessonDraft } from "@/lib/planning/today-lesson-generation";
import type { DailyWorkspaceLessonBuildTrigger } from "@/lib/planning/types";

const RequestSchema = z.object({
  date: z.string().optional(),
  debug: z.boolean().optional(),
  trigger: z.enum(["onboarding_auto", "today_resume", "manual"]).optional(),
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

  if (parsed.data.debug) {
    const promptPreview = await previewTodayLessonDraft({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date,
    });

    return NextResponse.json({
      date,
      debug: promptPreview,
    });
  }

  const trigger: DailyWorkspaceLessonBuildTrigger = parsed.data.trigger ?? "manual";

  try {
    const result = await generateTodayLessonDraft({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date,
      trigger,
      forceRegenerate: trigger === "manual",
    });

    return NextResponse.json({
      structured: result.structured,
      promptVersion: result.promptVersion,
      artifactId: result.artifactId,
      sourceTitle: result.sourceTitle,
      date: result.date,
      summary: result.summary,
      lineage: result.lineage,
      trace: result.trace,
      reusedExistingDraft: result.reusedExistingDraft,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lesson plan generation failed." },
      { status: 500 },
    );
  }
}
