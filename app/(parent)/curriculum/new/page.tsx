import { NewCurriculumClientPage } from "@/components/curriculum/new-curriculum-page";
import { requireAppSession } from "@/lib/app-session/server";
import { getHomeschoolHouseholdPreferences } from "@/lib/homeschool/preferences";

type NewCurriculumPageProps = {
  searchParams: Promise<{
    entry?: string | string[];
  }>;
};

export default async function NewCurriculumPage({ searchParams }: NewCurriculumPageProps) {
  const [session, preferences, params] = await Promise.all([
    requireAppSession(),
    requireAppSession().then((resolvedSession) =>
      getHomeschoolHouseholdPreferences(resolvedSession.organization.id),
    ),
    searchParams,
  ]);
  const initialEntry =
    typeof params.entry === "string" && params.entry === "conversation"
      ? "conversation"
      : "source";

  return (
    <NewCurriculumClientPage
      activeLearner={{
        id: session.activeLearner.id,
        displayName: session.activeLearner.displayName,
        firstName: session.activeLearner.firstName,
      }}
      organizationId={session.organization.id}
      defaultSchoolYearLabel={preferences.schoolYearLabel}
      initialEntry={initialEntry}
    />
  );
}
