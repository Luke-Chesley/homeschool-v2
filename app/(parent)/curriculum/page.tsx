import * as React from "react";

import { CurriculumEmptyState } from "@/components/curriculum/curriculum-empty-state";
import { CurriculumOverview } from "@/components/curriculum/curriculum-overview";
import { requireAppSession } from "@/lib/app-session/server";
import { getCurriculumTree, listCurriculumSources } from "@/lib/curriculum/service";

export const metadata = {
  title: "Curriculum",
};

interface CurriculumPageProps {
  searchParams: Promise<{ sourceId?: string }>;
}

export default async function CurriculumPage({ searchParams }: CurriculumPageProps) {
  const session = await requireAppSession();
  const params = await searchParams;
  const sources = await listCurriculumSources(session.organization.id);

  if (sources.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
        <header>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with one source and build a normalized tree the planner can route.
          </p>
        </header>
        <CurriculumEmptyState householdId={session.organization.id} />
      </main>
    );
  }

  const selectedSourceId =
    params.sourceId && sources.some((source) => source.id === params.sourceId)
      ? params.sourceId
      : sources[0].id;
  const tree = await getCurriculumTree(selectedSourceId);

  if (!tree) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
        <header>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The selected source could not be loaded right now.
          </p>
        </header>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
      <header>
        <h1 className="font-serif text-4xl leading-tight tracking-tight">Curriculum</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Canonical overview from normalized curriculum nodes.
        </p>
      </header>
      <CurriculumOverview sources={sources} selectedSourceId={selectedSourceId} tree={tree} />
    </main>
  );
}
