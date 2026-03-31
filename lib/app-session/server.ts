import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AppLearner, AppWorkspace } from "@/lib/users/service";
import { getWorkspaceContext } from "@/lib/users/service";

export const APP_ORGANIZATION_COOKIE = "hsv2_org_id";
export const APP_LEARNER_COOKIE = "hsv2_learner_id";

export async function getAppSession() {
  const cookieStore = await cookies();

  return getWorkspaceContext({
    organizationId: cookieStore.get(APP_ORGANIZATION_COOKIE)?.value ?? null,
    learnerId: cookieStore.get(APP_LEARNER_COOKIE)?.value ?? null,
  });
}

export async function requireAppSession(): Promise<AppWorkspace & { activeLearner: AppLearner }> {
  const session = await getAppSession();

  if (!session.activeLearner) {
    redirect("/users");
  }

  return session as AppWorkspace & { activeLearner: AppLearner };
}
