import { NextRequest, NextResponse } from "next/server";

import {
  APP_LEARNER_COOKIE,
  APP_ORGANIZATION_COOKIE,
  getAppSession,
} from "@/lib/app-session/server";
import {
  completeHomeschoolOnboarding,
  HomeschoolOnboardingSchema,
} from "@/lib/homeschool/onboarding/service";
import { trackOperationalError } from "@/lib/platform/observability";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const session = await getAppSession();
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

  try {
    const result = await completeHomeschoolOnboarding(parsed.data);
    const response = NextResponse.json(result, { status: 200 });
    response.cookies.set(APP_ORGANIZATION_COOKIE, session.organization.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set(APP_LEARNER_COOKIE, result.learnerId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return response;
  } catch (error) {
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
