import { UserManager } from "@/components/users/user-manager";
import { getAppSession } from "@/lib/app-session/server";

export const metadata = {
  title: "Users",
};

export default async function UsersPage() {
  const session = await getAppSession();

  return (
    <UserManager
      organization={session.organization}
      learners={session.learners}
      activeLearnerId={session.activeLearner?.id ?? null}
    />
  );
}
