import { notFound } from "next/navigation";

import { DayPlanView } from "@/components/planning/day-plan-view";
import { PlanningShell } from "@/components/planning/planning-shell";
import { getPlanningDayView } from "@/lib/planning/service";

interface PlanningDayPageProps {
  params: Promise<{
    date: string;
  }>;
}

export default async function PlanningDayPage({
  params,
}: PlanningDayPageProps) {
  const { date } = await params;
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
