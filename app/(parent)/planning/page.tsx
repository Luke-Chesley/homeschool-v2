import { PlanningShell } from "@/components/planning/planning-shell";
import { WeeklyPlanningBoard } from "@/components/planning/weekly-planning-board";
import { getWeeklyPlanningView } from "@/lib/planning/service";

export default function PlanningPage() {
  const week = getWeeklyPlanningView();

  return (
    <PlanningShell
      currentView="week"
      title="Weekly planning with explicit room for recovery."
      description="This planner treats dated lesson work as the source of truth, keeps carryover visible, and leaves obvious insertion points for artifacts, copilot actions, and later reporting."
    >
      <WeeklyPlanningBoard week={week} />
    </PlanningShell>
  );
}
