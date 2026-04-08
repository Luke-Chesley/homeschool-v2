import { redirect } from "next/navigation";

import { UserManager } from "@/components/users/user-manager";
import { getAppSession } from "@/lib/app-session/server";
import { getHomeschoolOnboardingStatus } from "@/lib/homeschool/onboarding/service";

export const metadata = {
  title: "Users",
};

export default async function UsersPage() {
  const session = await getAppSession();
  const onboarding = await getHomeschoolOnboardingStatus(session.organization.id);

  if (!onboarding.isComplete) {
    redirect("/onboarding");
  }

  return (
    <UserManager
      organization={session.organization}
      learners={session.learners}
      activeLearnerId={session.activeLearner?.id ?? null}
    />
  );
}
