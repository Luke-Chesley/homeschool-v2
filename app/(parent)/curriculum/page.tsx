import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { CurriculumEmptyState } from "@/components/curriculum/curriculum-empty-state";
import { CurriculumOverview } from "@/components/curriculum/curriculum-overview";
import { buttonVariants } from "@/components/ui/button";
import { requireAppSession } from "@/lib/app-session/server";
import {
  getCurriculumTree,
  getLiveCurriculumSource,
  listCurriculumSources,
  setLiveCurriculumSource,
} from "@/lib/curriculum/service";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Curriculum",
};

export default async function CurriculumPage() {
  const session = await requireAppSession();
  const organizationId = session.organization.id;
  const [sources, activeSource] = await Promise.all([
    listCurriculumSources(organizationId),
    getLiveCurriculumSource(organizationId),
  ]);

  if (sources.length === 0) {
    return (
      <main className="page-shell page-stack">
        <CurriculumEmptyState />
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
      <main className="page-shell page-stack">
        <p className="text-sm text-muted-foreground">The live curriculum source could not be loaded.</p>
      </main>
    );
  }

  return (
    <main className="page-shell page-stack">
      <header className="page-header">
        <p className="section-meta">Curriculum</p>
        <h1 className="page-title">Curriculum sources</h1>
        <p className="page-subtitle max-w-3xl">
          Keep one live curriculum source in view so planning, today, and tracking all stay aligned.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/curriculum/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Add a source
          </Link>
          <Link
            href="/curriculum/new?entry=conversation"
            className={cn(buttonVariants({ size: "sm" }), "gap-2")}
          >
            <Sparkles className="size-4" />
            Start conversation
          </Link>
        </div>
      </header>
      <CurriculumOverview
        sources={sources}
        activeSourceId={activeSourceId}
        onActivateSource={activateSourceAction}
        tree={tree}
      />
    </main>
  );
}
