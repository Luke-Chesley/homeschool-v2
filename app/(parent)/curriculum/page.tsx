import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookOpen, Sparkles } from "lucide-react";

import { CurriculumEmptyState } from "@/components/curriculum/curriculum-empty-state";
import { CurriculumOverview } from "@/components/curriculum/curriculum-overview";
import { buttonVariants } from "@/components/ui/button";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
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
        <EmptyStatePanel
          title="The live curriculum source could not be loaded."
          body="Try reopening the source list and setting the live curriculum again."
          icon={BookOpen}
        />
      </main>
    );
  }

  return (
    <main className="page-shell page-stack">
      <header className="page-header">
        <div className="dashboard-grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.8fr)]">
          <div className="space-y-4">
            <p className="section-meta">Curriculum</p>
            <div className="space-y-3">
              <h1 className="page-title">Keep the live curriculum clear.</h1>
              <p className="page-subtitle max-w-3xl">
                Review sources, make the right one live, and keep planning, Today, and tracking aligned to the same structure.
              </p>
            </div>
            <div className="toolbar-row">
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
          </div>

          <aside className="context-rail space-y-3">
            <p className="section-meta">Current emphasis</p>
            <p className="text-lg font-semibold text-foreground">{tree.source.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              The live source should be the one you want shaping this week&apos;s plan and today&apos;s queue.
            </p>
          </aside>
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
