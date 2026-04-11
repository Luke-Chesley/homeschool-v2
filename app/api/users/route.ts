import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAppSession,
  isAppApiSessionError,
  requireAppApiSession,
  setWorkspaceCookies,
} from "@/lib/app-session/server";
import { createLearnerForOrganization } from "@/lib/users/service";

const CreateLearnerSchema = z.object({
  displayName: z.string().min(1).max(80),
});

export async function GET() {
  try {
    const session = await getAppSession();
    return NextResponse.json(session);
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = CreateLearnerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Display name is required." }, { status: 400 });
    }

    const session = await requireAppApiSession({ requireLearner: false });
    const organization = session.organization;
    const learner = await createLearnerForOrganization(organization.id, {
      displayName: parsed.data.displayName,
    });

    const response = NextResponse.json({ learner }, { status: 201 });
    return setWorkspaceCookies({
      response,
      organizationId: organization.id,
      learnerId: learner.id,
    });
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not create learner." }, { status: 500 });
  }
}
