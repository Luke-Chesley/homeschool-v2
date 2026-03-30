import { notFound } from "next/navigation";

import { PlanningShell } from "@/components/planning/planning-shell";
import { TodayWorkspaceView } from "@/components/planning/today-workspace-view";
import { getTodayWorkspace } from "@/lib/planning/service";

export default function TodayPage() {
  const workspace = getTodayWorkspace();

  if (!workspace) {
    notFound();
  }

  return (
    <PlanningShell
      currentView="today"
      title="The daily workspace for running a lesson, not just planning one."
      description="This surface keeps execution, prep, generated-asset placeholders, and tracking handoff on the same screen so the operational day stays coherent."
    >
      <TodayWorkspaceView workspace={workspace} />
    </PlanningShell>
  );
}
