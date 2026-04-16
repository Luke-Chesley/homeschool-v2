import { NextRequest, NextResponse } from "next/server";

import {
  isAppApiSessionError,
  requireAppApiSession,
  setWorkspaceCookies,
} from "@/lib/app-session/server";
import {
  completeHomeschoolOnboarding,
  HomeschoolFastPathOnboardingSchema,
  HomeschoolOnboardingSchema,
  runHomeschoolFastPathOnboarding,
} from "@/lib/homeschool/onboarding/service";
import { trackOperationalError } from "@/lib/platform/observability";

function getSafeOnboardingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Onboarding failed.";
  if (
    message.includes("SourceInterpretationArtifact")
    || message.includes("recommendedHorizon")
    || message.includes("OUTPUT_PARSING_FAILURE")
  ) {
    return "We couldn't interpret that source just yet. Please try again.";
  }
  return message;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  try {
    const session = await requireAppApiSession({ requireLearner: false });
    const withOrgId = {
      ...body,
      organizationId: session.organization.id,
    };
    const fastPathParsed = HomeschoolFastPathOnboardingSchema.safeParse(withOrgId);

    if (fastPathParsed.success) {
      const result = await runHomeschoolFastPathOnboarding(fastPathParsed.data);
      const response = NextResponse.json(result, { status: 200 });
      if (result.mode === "completed") {
        return setWorkspaceCookies({
          response,
          organizationId: session.organization.id,
          learnerId: result.learnerId,
        });
      }
      return response;
    }

    const parsed = HomeschoolOnboardingSchema.safeParse(withOrgId);

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

    const safeMessage = getSafeOnboardingErrorMessage(error);
    console.error("[api/homeschool/onboarding POST]", error);
    trackOperationalError({
      source: "api/homeschool/onboarding",
      message: error instanceof Error ? error.message : "Onboarding failed.",
    });
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 },
    );
  }
}
