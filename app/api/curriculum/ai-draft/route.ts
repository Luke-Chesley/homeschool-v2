import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import {
  CurriculumAiFailureResultSchema,
  CurriculumAiCreateRequestSchema,
  CurriculumAiCreateResultSchema,
} from "@/lib/curriculum/ai-draft";
import { getCurriculumTree, listCurriculumOutline } from "@/lib/curriculum/service";
import { createCurriculumFromConversationIntake } from "@/lib/homeschool/onboarding/curriculum";

const MAX_FAILURE_REASON_LENGTH = 120;

function truncateFailureReason(reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length <= MAX_FAILURE_REASON_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_FAILURE_REASON_LENGTH - 3)}...`;
}

function countEstimatedSessions(
  units: Array<{ estimatedSessions?: number | null }>,
) {
  return units.reduce(
    (total, unit) => total + (unit.estimatedSessions ?? 0),
    0,
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CurriculumAiCreateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const session = await requireAppSession();
    try {
      const created = await createCurriculumFromConversationIntake({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        learnerName: session.activeLearner.displayName,
        messages: parsed.data.messages,
        surface: "curriculum",
        workflowMode: "curriculum_creation",
      });

      const [tree, outline] = await Promise.all([
        getCurriculumTree(created.curriculum.id, session.organization.id),
        listCurriculumOutline(created.curriculum.id),
      ]);

      const payload = CurriculumAiCreateResultSchema.parse({
        kind: "success",
        sourceId: created.curriculum.id,
        sourceTitle: created.curriculum.title,
        nodeCount: tree?.nodeCount ?? 0,
        skillCount: tree?.skillCount ?? 0,
        unitCount: outline.length,
        lessonCount: outline.reduce((total, unit) => total + unit.lessons.length, 0),
        estimatedSessionCount: countEstimatedSessions(created.artifact.units),
      });

      return NextResponse.json(payload, { status: 200 });
    } catch (error) {
      const payload = CurriculumAiFailureResultSchema.parse({
        kind: "failure",
        stage: "generation",
        reason: truncateFailureReason(
          error instanceof Error ? error.message : "Generation failed",
        ),
        userSafeMessage: "Could not generate this curriculum yet.",
        issues: [],
        attemptCount: 1,
        retryable: false,
      });

      return NextResponse.json(payload, { status: 422 });
    }
  } catch (error) {
    console.error("[api/curriculum/ai-draft POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
