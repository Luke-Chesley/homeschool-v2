import { NewCurriculumClientPage } from "@/components/curriculum/new-curriculum-page";
import { requireAppSession } from "@/lib/app-session/server";
import { getHomeschoolHouseholdPreferences } from "@/lib/homeschool/preferences";

export default async function NewCurriculumPage() {
  const session = await requireAppSession();
  const preferences = await getHomeschoolHouseholdPreferences(session.organization.id);
  return (
    <NewCurriculumClientPage
      activeLearner={{
        displayName: session.activeLearner.displayName,
        firstName: session.activeLearner.firstName,
      }}
      defaultSchoolYearLabel={preferences.schoolYearLabel}
    />
  );
}
