import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CurriculumEmptyState } from "@/components/curriculum/curriculum-empty-state";
import { CurriculumGraphWorkspace } from "@/components/curriculum/curriculum-graph-workspace";
import { CurriculumRefinementWidget } from "@/components/curriculum/CurriculumRefinementWidget";
import { buttonVariants } from "@/components/ui/button";
import { requireAppSession } from "@/lib/app-session/server";
import { getCurriculumTree, listCurriculumSources } from "@/lib/curriculum/service";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Curriculum Graph",
};

interface CurriculumGraphPageProps {
  searchParams: Promise<{ sourceId?: string }>;
}

export default async function CurriculumGraphPage({ searchParams }: CurriculumGraphPageProps) {
  const session = await requireAppSession();
  const params = await searchParams;
  const sources = await listCurriculumSources(session.organization.id);

  if (sources.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
        <header className="space-y-3">
          <Link href="/curriculum" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-3")}>
            <ArrowLeft className="size-4" />
            Back to curriculum
          </Link>
          <div>
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum graph</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with one source and build a connected map the planner can route.
            </p>
          </div>
        </header>
        <CurriculumEmptyState householdId={session.organization.id} />
      </main>
    );
  }

  const selectedSourceId =
    params.sourceId && sources.some((source) => source.id === params.sourceId)
      ? params.sourceId
      : sources[0].id;
  const tree = await getCurriculumTree(selectedSourceId, session.organization.id);

  if (!tree) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
        <header className="space-y-3">
          <Link href="/curriculum" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-3")}>
            <ArrowLeft className="size-4" />
            Back to curriculum
          </Link>
          <div>
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum graph</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The selected source could not be loaded right now.
            </p>
          </div>
        </header>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1700px] flex-col gap-6 px-6 py-8 sm:px-8">
      <header className="space-y-3">
        <Link href={`/curriculum?sourceId=${selectedSourceId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-3")}>
          <ArrowLeft className="size-4" />
          Back to curriculum
        </Link>
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum graph</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Explore the source as a connected node map. Follow the hierarchy, inspect sequencing,
            and focus on one branch at a time without collapsing everything into a list.
          </p>
        </div>
      </header>
      <CurriculumGraphWorkspace
        sources={sources}
        selectedSourceId={selectedSourceId}
        tree={tree}
      />
      <CurriculumRefinementWidget sourceId={selectedSourceId} sourceTitle={tree.source.title} />
    </main>
  );
}
