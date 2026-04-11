import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAuthSession } from "@/lib/auth/server";
import { bootstrapWorkspaceForAuthUser } from "@/lib/auth/identity";
import { setWorkspaceCookies } from "@/lib/app-session/server";

const SetupSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
});

export async function POST(request: NextRequest) {
  const { user } = await getRequestAuthSession();
  if (!user) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  try {
    const result = await bootstrapWorkspaceForAuthUser({
      user,
      organizationName: parsed.data.organizationName,
    });

    const response = NextResponse.json({ organization: result.organization }, { status: 201 });
    return setWorkspaceCookies({
      response,
      organizationId: result.organization.id,
      learnerId: null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create workspace." },
      { status: 500 },
    );
  }
}
