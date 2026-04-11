import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ParentShell } from "@/components/parent-shell/parent-shell";
import { getAppSession } from "@/lib/app-session/server";
import { getHomeschoolOnboardingStatus } from "@/lib/homeschool/onboarding/service";
import { getStudioAccess } from "@/lib/studio/access";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const session = await getAppSession();
  const onboarding = await getHomeschoolOnboardingStatus(session.organization.id);
  const studioAccess = getStudioAccess();

  if (!onboarding.isComplete) {
    redirect("/onboarding");
  }

  if (!session.activeLearner) {
    redirect("/onboarding");
  }

  return (
    <ParentShell
      activeLearnerName={session.activeLearner.displayName}
      organizationName={session.organization.name}
      learnerLabel={session.platformSettings.learnerLabel}
      studioAccess={studioAccess}
    >
      {children}
    </ParentShell>
  );
}
