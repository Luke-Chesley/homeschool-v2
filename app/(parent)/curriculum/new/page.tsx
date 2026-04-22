import { NewCurriculumClientPage } from "@/components/curriculum/new-curriculum-page";
import { requireAppSession } from "@/lib/app-session/server";

type NewCurriculumPageProps = {
  searchParams: Promise<{
    entry?: string | string[];
  }>;
};

export default async function NewCurriculumPage({ searchParams }: NewCurriculumPageProps) {
  const [session, params] = await Promise.all([requireAppSession(), searchParams]);
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
      initialEntry={initialEntry}
    />
  );
}
