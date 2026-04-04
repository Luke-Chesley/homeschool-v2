import { notFound, redirect } from "next/navigation";

import { DayPlanView } from "@/components/planning/day-plan-view";
import { PlanningShell } from "@/components/planning/planning-shell";
import { Card } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
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
  const liveSource = await getLiveCurriculumSource(session.organization.id);

  if (selectedRouteItemId) {
    await selectRouteItemForPlanningDay({
      learnerId: session.activeLearner.id,
      date,
      weeklyRouteItemId: selectedRouteItemId,
    });
    redirect(`/planning/day/${date}`);
  }

  if (!liveSource) {
    notFound();
  }

  const result = await getPlanningDayView({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    date,
  });

  if (!result) {
    notFound();
  }

  return (
    <PlanningShell>
      <Card className="mb-4">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Live curriculum
            </p>
            <p className="font-medium text-foreground">{liveSource.title}</p>
          </div>
        </div>
      </Card>
      <DayPlanView day={result.day} />
    </PlanningShell>
  );
}
