import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import {
  buildHomeschoolCurriculumGenerationJobInputForCurriculumIntake,
  createHomeschoolCurriculumFromIntake,
  HomeschoolCurriculumIntakePayload,
  HomeschoolCurriculumIntakeSchema,
} from "@/lib/homeschool/onboarding/service";
import { dispatchCurriculumGeneration } from "@/lib/ai/task-service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const session = await requireAppSession();
  const parsed = HomeschoolCurriculumIntakeSchema.safeParse({
    ...body,
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    learnerFirstName: session.activeLearner.firstName,
    learnerLastName: session.activeLearner.lastName,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid curriculum intake input.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.curriculumMode === "ai_decompose") {
      const job = await dispatchCurriculumGeneration(
        buildHomeschoolCurriculumGenerationJobInputForCurriculumIntake(
          parsed.data as HomeschoolCurriculumIntakePayload,
        ),
        {
          organizationId: session.organization.id,
          learnerId: session.activeLearner.id,
        },
      );
      return NextResponse.json(
        { mode: "queued", jobId: job.jobId, status: "queued" },
        { status: 202 },
      );
    }

    const result = await createHomeschoolCurriculumFromIntake(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[api/homeschool/curriculum-intake POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create curriculum." },
      { status: 500 },
    );
  }
}
