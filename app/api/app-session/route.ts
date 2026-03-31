import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  APP_LEARNER_COOKIE,
  APP_ORGANIZATION_COOKIE,
  getAppSession,
} from "@/lib/app-session/server";
import { getLearnerById } from "@/lib/users/service";

const SetSessionSchema = z.object({
  learnerId: z.string().min(1),
});

export async function GET() {
  const session = await getAppSession();

  return NextResponse.json({
    organization: session.organization,
    activeLearner: session.activeLearner,
    learners: session.learners,
  });
}

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  const body = await req.json().catch(() => null);
  const parsed = SetSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const learner = await getLearnerById(parsed.data.learnerId, {
    organizationId: session.organization.id,
  });
  if (!learner) {
    return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  }

  const response = NextResponse.json({ learner });
  response.cookies.set(APP_ORGANIZATION_COOKIE, learner.organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  response.cookies.set(APP_LEARNER_COOKIE, learner.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
