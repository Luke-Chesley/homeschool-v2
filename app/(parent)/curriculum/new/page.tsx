import { requireAppSession } from "@/lib/app-session/server";
import { NewCurriculumClientPage } from "@/components/curriculum/new-curriculum-page";

export default async function NewCurriculumPage() {
  const session = await requireAppSession();
  return <NewCurriculumClientPage householdId={session.organization.id} />;
}
