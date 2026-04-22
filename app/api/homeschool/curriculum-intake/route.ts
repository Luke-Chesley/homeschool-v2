import { after, NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import {
  finishHomeschoolCurriculumIntakeGeneration,
  HomeschoolCurriculumIntakeSchema,
  startHomeschoolCurriculumIntakeGeneration,
} from "@/lib/homeschool/onboarding/service";

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
    const started = await startHomeschoolCurriculumIntakeGeneration(parsed.data);
    after(async () => {
      try {
        await finishHomeschoolCurriculumIntakeGeneration(started.backgroundTask);
      } catch (error) {
        console.error("[api/homeschool/curriculum-intake POST after]", error);
      }
    });
    return NextResponse.json(
      {
        mode: "queued",
        sourceId: started.sourceId,
        sourceTitle: started.sourceTitle,
        redirectTo: started.redirectTo,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("[api/homeschool/curriculum-intake POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create curriculum." },
      { status: 500 },
    );
  }
}
