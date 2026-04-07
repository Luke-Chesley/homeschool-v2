import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CurriculumEmptyState } from "@/components/curriculum/curriculum-empty-state";
import { CurriculumExportCard } from "@/components/curriculum/CurriculumExportCard";
import { CurriculumProgressionGraph } from "@/components/curriculum/curriculum-progression-graph";
import { CurriculumRefinementWidget } from "@/components/curriculum/CurriculumRefinementWidget";
import { buttonVariants } from "@/components/ui/button";
import { requireAppSession } from "@/lib/app-session/server";
import {
  getCurriculumProgression,
  getCurriculumTree,
  getLiveCurriculumSource,
  listCurriculumOutline,
  listCurriculumSources,
} from "@/lib/curriculum/service";
import { buildProgressionGraph } from "@/lib/curriculum/progression-graph-model";
import { cn } from "@/lib/utils";
import { regenerateProgressionAction } from "./actions";

export const metadata = {
  title: "Curriculum Progression Graph",
};

interface CurriculumGraphPageProps {
  searchParams: Promise<{ sourceId?: string }>;
}

export default async function CurriculumGraphPage({ searchParams }: CurriculumGraphPageProps) {
  const session = await requireAppSession();
  const params = await searchParams;
  const sources = await listCurriculumSources(session.organization.id);
  const activeSource = await getLiveCurriculumSource(session.organization.id);

  if (sources.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
        <header className="space-y-3">
          <Link href="/curriculum" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-3")}>
            <ArrowLeft className="size-4" />
            Back to curriculum
          </Link>
          <div>
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Progression graph</h1>
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
      : activeSource?.id ?? sources[0].id;

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
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Progression graph</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The selected source could not be loaded right now.
            </p>
          </div>
        </header>
      </main>
    );
  }

  const [progression, outline] = await Promise.all([
    getCurriculumProgression(selectedSourceId),
    listCurriculumOutline(selectedSourceId),
  ]);

  const graph = buildProgressionGraph(tree, progression);

  const exportText = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: tree.source,
      tree,
      outline,
      progression: {
        diagnostics: progression.diagnostics,
        phases: progression.phases,
        prerequisites: progression.prerequisites,
      },
      progressionGraph: {
        nodes: graph.nodes,
        edges: graph.edges,
      },
    },
    null,
    2,
  );

  return (
    <main className="mx-auto flex w-full max-w-[1700px] flex-col gap-6 px-6 py-8 sm:px-8">
      <header className="space-y-3">
        <Link href="/curriculum" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-3")}>
          <ArrowLeft className="size-4" />
          Back to curriculum
        </Link>
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Progression graph</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Left-to-right progression map. Phases are columns; skills are nodes. Edges show prerequisite
            and sequencing relationships. Click any skill to inspect its connections.
          </p>
        </div>
      </header>
      <CurriculumProgressionGraph
        sources={sources}
        selectedSourceId={selectedSourceId}
        graph={graph}
        progressionDebug={progression}
        regenerateAction={regenerateProgressionAction}
      />
      <CurriculumExportCard title="Export" text={exportText} />
      <CurriculumRefinementWidget sourceId={selectedSourceId} sourceTitle={tree.source.title} />
    </main>
  );
}
