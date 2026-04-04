import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { CurriculumEmptyState } from "@/components/curriculum/curriculum-empty-state";
import { CurriculumOverview } from "@/components/curriculum/curriculum-overview";
import { requireAppSession } from "@/lib/app-session/server";
import {
  getCurriculumTree,
  getLiveCurriculumSource,
  listCurriculumSources,
  setLiveCurriculumSource,
} from "@/lib/curriculum/service";

export const metadata = {
  title: "Curriculum",
};

export default async function CurriculumPage() {
  const session = await requireAppSession();
  const organizationId = session.organization.id;
  const sources = await listCurriculumSources(session.organization.id);
  const activeSource = await getLiveCurriculumSource(session.organization.id);

  if (sources.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
        <CurriculumEmptyState householdId={session.organization.id} />
      </main>
    );
  }

  const activeSourceId = activeSource?.id ?? sources[0].id;
  const tree = await getCurriculumTree(activeSourceId, session.organization.id);

  async function activateSourceAction(formData: FormData) {
    "use server";

    const sourceId = formData.get("sourceId");

    if (typeof sourceId !== "string" || sourceId.length === 0) {
      redirect("/curriculum");
    }

    await setLiveCurriculumSource(organizationId, sourceId);

    revalidatePath("/curriculum");
    revalidatePath("/curriculum/graph");
    revalidatePath("/curriculum/manage");
    revalidatePath("/planning");
    revalidatePath("/planning/month");
    revalidatePath("/today");
    revalidatePath("/tracking");
    revalidatePath("/copilot");

    redirect("/curriculum");
  }

  if (!tree) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">The live curriculum source could not be loaded.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
      <CurriculumOverview
        sources={sources}
        activeSourceId={activeSourceId}
        onActivateSource={activateSourceAction}
        tree={tree}
      />
    </main>
  );
}
