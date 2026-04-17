import { ReportsView, TrackingShell } from "@/components/tracking";
import { requireAppSession } from "@/lib/app-session/server";
import { getTrackingDashboard } from "@/lib/tracking/service";

export const metadata = {
  title: "Reports",
};

export default async function TrackingReportsPage() {
  const session = await requireAppSession();
  const dashboard = await getTrackingDashboard({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
  });

  return (
    <TrackingShell
      currentView="reports"
      title="Editable report drafts and export shells"
      description="Draft the quarterly, annual, evaluation, and portfolio outputs directly from the tracking record, then export them when they are ready."
    >
      <ReportsView dashboard={dashboard} />
    </TrackingShell>
  );
}
