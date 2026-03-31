import { notFound, redirect } from "next/navigation";

import { DayPlanView } from "@/components/planning/day-plan-view";
import { PlanningShell } from "@/components/planning/planning-shell";
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
  const { date } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedRouteItemId =
    typeof resolvedSearchParams.selectRouteItemId === "string"
      ? resolvedSearchParams.selectRouteItemId
      : undefined;

  if (selectedRouteItemId) {
    selectRouteItemForPlanningDay(date, selectedRouteItemId);
    redirect(`/planning/day/${date}`);
  }

  const day = getPlanningDayView(date);

  if (!day) {
    notFound();
  }

  return (
    <PlanningShell
      currentView="day"
      title="A day plan that makes tradeoffs explicit."
      description="The day view keeps timing, constraints, materials, recovery choices, and downstream hooks visible in one place so rescheduling stays deliberate instead of reactive."
    >
      <DayPlanView day={day} />
    </PlanningShell>
  );
}
