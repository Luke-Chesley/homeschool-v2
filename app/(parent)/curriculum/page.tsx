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
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
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
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">The selected source could not be loaded.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
      <CurriculumOverview sources={sources} selectedSourceId={selectedSourceId} tree={tree} />
    </main>
  );
}
