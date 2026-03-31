import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  APP_LEARNER_COOKIE,
  APP_ORGANIZATION_COOKIE,
  getAppSession,
} from "@/lib/app-session/server";
import {
  createLearnerForOrganization,
  ensureAppOrganization,
} from "@/lib/users/service";

const CreateLearnerSchema = z.object({
  displayName: z.string().min(1).max(80),
});

export async function GET() {
  const session = await getAppSession();
  return NextResponse.json(session);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateLearnerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }

  const organization = await ensureAppOrganization();
  const learner = await createLearnerForOrganization(organization.id, {
    displayName: parsed.data.displayName,
  });

  const response = NextResponse.json({ learner }, { status: 201 });
  response.cookies.set(APP_ORGANIZATION_COOKIE, organization.id, {
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
