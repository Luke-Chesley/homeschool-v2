import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAppSession,
  isAppApiSessionError,
  requireAppApiSession,
  setWorkspaceCookies,
} from "@/lib/app-session/server";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";
import { getLearnerById } from "@/lib/users/service";

const SetSessionSchema = z.object({
  learnerId: z.string().min(1),
});

export async function GET() {
  try {
    const session = await getAppSession();

    return NextResponse.json({
      organization: session.organization,
      activeLearner: session.activeLearner,
      learners: session.learners,
      memberships: session.memberships,
    });
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAppApiSession({ requireLearner: false });
    const body = await req.json().catch(() => null);
    const parsed = SetSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const learner = await getLearnerById(parsed.data.learnerId, {
      organizationId: session.organization.id,
    });
    if (!learner) {
      await trackProductEvent({
        name: ACTIVATION_EVENT_NAMES.activeLearnerSwitchFailed,
        organizationId: session.organization.id,
        metadata: { learnerId: parsed.data.learnerId, reason: "not_found" },
      });
      return NextResponse.json({ error: "Learner not found." }, { status: 404 });
    }
    if (learner.status === "archived") {
      await trackProductEvent({
        name: ACTIVATION_EVENT_NAMES.activeLearnerSwitchFailed,
        organizationId: session.organization.id,
        learnerId: learner.id,
        metadata: { reason: "archived" },
      });
      return NextResponse.json({ error: "Archived learners cannot be selected." }, { status: 409 });
    }

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.activeLearnerSwitched,
      organizationId: session.organization.id,
      learnerId: learner.id,
      metadata: {
        fromLearnerId: session.activeLearner?.id ?? null,
        toLearnerId: learner.id,
      },
    });

    const response = NextResponse.json({ learner });
    return setWorkspaceCookies({
      response,
      organizationId: learner.organizationId,
      learnerId: learner.id,
    });
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not update workspace." }, { status: 500 });
  }
}
