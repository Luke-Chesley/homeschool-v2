import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookOpen, Sparkles } from "lucide-react";

import { CurriculumGenerationNotice } from "@/components/curriculum/curriculum-generation-notice";
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

type CurriculumPageProps = {
  searchParams?: Promise<{
    pendingSourceId?: string | string[];
  }>;
};

export default async function CurriculumPage({ searchParams }: CurriculumPageProps) {
  const [session, resolvedParams] = await Promise.all([
    requireAppSession(),
    searchParams ?? Promise.resolve({ pendingSourceId: undefined }),
  ]);
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
  const pendingSourceId =
    typeof resolvedParams.pendingSourceId === "string" ? resolvedParams.pendingSourceId : null;
  const pendingSource =
    pendingSourceId ? sources.find((source) => source.id === pendingSourceId) ?? null : null;
  const pendingSourceIsGenerating = pendingSource?.status === "draft";
  const focusedSourceId = pendingSourceIsGenerating ? pendingSource.id : activeSourceId;
  const tree = await getCurriculumTree(focusedSourceId, session.organization.id);

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
    revalidatePath("/assistant");

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
              {pendingSource?.id === tree.source.id
                ? pendingSource.status === "failed_import"
                  ? "This source shell was saved, but curriculum generation failed. The current live curriculum has not been changed."
                  : pendingSource.status === "draft"
                    ? "This source is still generating. We will switch planning to it automatically once it is ready."
                    : "This source is ready and already shaping the live curriculum."
                : "The live source should be the one you want shaping this week&apos;s plan and today&apos;s queue."}
            </p>
          </aside>
        </div>
      </header>
      {pendingSource ? (
        <CurriculumGenerationNotice
          sourceId={pendingSource.id}
          sourceTitle={pendingSource.title}
          status={pendingSource.status}
        />
      ) : null}
      <CurriculumOverview
        sources={sources}
        activeSourceId={activeSourceId}
        onActivateSource={activateSourceAction}
        tree={tree}
        focusMode={
          pendingSource?.id === tree.source.id
            ? pendingSource.status === "failed_import"
              ? "failed"
              : pendingSource.status === "draft"
                ? "pending"
                : "live"
            : "live"
        }
        liveSourceTitle={
          pendingSource?.id === tree.source.id && pendingSource.status === "draft"
            ? sources.find((source) => source.id === activeSourceId)?.title ?? null
            : null
        }
      />
    </main>
  );
}
