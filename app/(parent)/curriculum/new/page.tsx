import { NewCurriculumClientPage } from "@/components/curriculum/new-curriculum-page";
import { requireAppSession } from "@/lib/app-session/server";

export default async function NewCurriculumPage() {
  const session = await requireAppSession();
  return (
    <NewCurriculumClientPage
      householdId={session.organization.id}
      activeLearner={{
        displayName: session.activeLearner.displayName,
        firstName: session.activeLearner.firstName,
      }}
    />
  );
}
