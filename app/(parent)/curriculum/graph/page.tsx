import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CurriculumEmptyState } from "@/components/curriculum/curriculum-empty-state";
import { CurriculumRoadmapWorkspace } from "@/components/curriculum/curriculum-roadmap-workspace";
import { buttonVariants } from "@/components/ui/button";
import { requireAppSession } from "@/lib/app-session/server";
import { createProgressionGenerationBasis } from "@/lib/curriculum/progression-basis";
import {
  getCurriculumProgression,
  getCurriculumTree,
  getLiveCurriculumSource,
  listCurriculumOutline,
  listCurriculumSources,
} from "@/lib/curriculum/service";
import { buildProgressionGraph } from "@/lib/curriculum/progression-graph-model";
import { buildCurriculumRoadmapModel } from "@/lib/curriculum/roadmap-model";
import { cn } from "@/lib/utils";
import { regenerateProgressionAction } from "./actions";

export const metadata = {
  title: "Curriculum Roadmap",
};

interface CurriculumGraphPageProps {
  searchParams: Promise<{ sourceId?: string; view?: string; skillId?: string }>;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
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
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum roadmap</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with a source, then read the teaching journey as a roadmap instead of a dense graph.
            </p>
          </div>
        </header>
        <CurriculumEmptyState />
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
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum roadmap</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The selected source could not be loaded right now.
            </p>
          </div>
        </header>
      </main>
    );
  }

  const [progression, outlineResult] = await Promise.all([
    getCurriculumProgression(selectedSourceId),
    listCurriculumOutline(selectedSourceId)
      .then((outline) => ({ outline, error: null as string | null }))
      .catch((error) => ({
        outline: [],
        error: toMessage(error),
      })),
  ]);
  const outline = outlineResult.outline;
  const outlineWarning = outlineResult.error;

  const basis = createProgressionGenerationBasis(
    {
      source: tree.source,
      tree,
      units: outline,
    },
    { allowUnitless: true },
  );
  const roadmap = buildCurriculumRoadmapModel({
    tree,
    progression,
    outline,
    basis,
  });
  const graph = buildProgressionGraph(tree, progression);
  const initialView =
    params.view === "structure" || params.view === "dependencies" || params.view === "roadmap"
      ? params.view
      : "roadmap";
  const initialFocusedSkillId =
    typeof params.skillId === "string" && roadmap.skillById[params.skillId] ? params.skillId : null;

  const exportText = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: tree.source,
      tree,
      outline,
      outlineLoadError: outlineWarning,
      roadmap,
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
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum roadmap</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Read the teaching journey phase by phase, see the actual work inside each chunk, then drill into
            structure or dependencies only when you need them.
          </p>
        </div>
      </header>
      <CurriculumRoadmapWorkspace
        sources={sources}
        selectedSourceId={selectedSourceId}
        tree={tree}
        roadmap={roadmap}
        graph={graph}
        exportText={exportText}
        outlineWarning={outlineWarning}
        progressionDebug={progression}
        initialView={initialView}
        initialFocusedSkillId={initialFocusedSkillId}
        regenerateAction={regenerateProgressionAction}
      />
    </main>
  );
}
