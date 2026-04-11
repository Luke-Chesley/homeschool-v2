import { NextRequest, NextResponse } from "next/server";

import {
  isAppApiSessionError,
  requireAppApiSession,
  setWorkspaceCookies,
} from "@/lib/app-session/server";
import {
  completeHomeschoolOnboarding,
  HomeschoolOnboardingSchema,
} from "@/lib/homeschool/onboarding/service";
import { trackOperationalError } from "@/lib/platform/observability";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  try {
    const session = await requireAppApiSession({ requireLearner: false });
    const parsed = HomeschoolOnboardingSchema.safeParse({
      ...body,
      organizationId: session.organization.id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid onboarding input.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await completeHomeschoolOnboarding(parsed.data);
    const response = NextResponse.json(result, { status: 200 });
    return setWorkspaceCookies({
      response,
      organizationId: session.organization.id,
      learnerId: result.learnerId,
    });
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error("[api/homeschool/onboarding POST]", error);
    trackOperationalError({
      source: "api/homeschool/onboarding",
      message: error instanceof Error ? error.message : "Onboarding failed.",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Onboarding failed." },
      { status: 500 },
    );
  }
}
