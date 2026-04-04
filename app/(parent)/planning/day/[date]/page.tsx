import { notFound, redirect } from "next/navigation";

import { DayPlanView } from "@/components/planning/day-plan-view";
import { PlanningShell } from "@/components/planning/planning-shell";
import { requireAppSession } from "@/lib/app-session/server";
import { listCurriculumSources } from "@/lib/curriculum/service";
import {
  getPlanningDayView,
  selectRouteItemForPlanningDay,
} from "@/lib/planning/service";

interface PlanningDayPageProps {
  params: Promise<{
    date: string;
  }>;
  searchParams: Promise<{
    selectRouteItemId?: string | string[];
    sourceId?: string | string[];
  }>;
}

export default async function PlanningDayPage({
  params,
  searchParams,
}: PlanningDayPageProps) {
  const session = await requireAppSession();
  const { date } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedRouteItemId =
    typeof resolvedSearchParams.selectRouteItemId === "string"
      ? resolvedSearchParams.selectRouteItemId
      : undefined;
  const requestedSourceId =
    typeof resolvedSearchParams.sourceId === "string"
      ? resolvedSearchParams.sourceId
      : undefined;

  const sources = await listCurriculumSources(session.organization.id);
  const selectedSourceId =
    requestedSourceId && sources.some((source) => source.id === requestedSourceId)
      ? requestedSourceId
      : sources[0]?.id;

  if (selectedRouteItemId) {
    await selectRouteItemForPlanningDay({
      learnerId: session.activeLearner.id,
      date,
      weeklyRouteItemId: selectedRouteItemId,
    });
    const redirectSourceQuery = selectedSourceId
      ? `?sourceId=${encodeURIComponent(selectedSourceId)}`
      : "";
    redirect(`/planning/day/${date}${redirectSourceQuery}`);
  }

  const result = await getPlanningDayView({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    date,
    sourceId: selectedSourceId,
  });

  if (!result) {
    notFound();
  }

  return (
    <PlanningShell>
      <DayPlanView day={result.day} />
    </PlanningShell>
  );
}
