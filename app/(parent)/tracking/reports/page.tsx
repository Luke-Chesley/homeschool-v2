import { ReportsView, TrackingShell } from "@/components/tracking";
import { requireAppSession } from "@/lib/app-session/server";
import { getTrackingDashboard } from "@/lib/tracking/service";

export const metadata = {
  title: "Reports And Exports",
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
      title="Reports that surface coverage, gaps, and next moves instead of just totals."
      description="Use the reporting view to connect lesson evidence, standards coverage, and broader goals in one export-friendly record set for households or larger organizations."
    >
      <ReportsView dashboard={dashboard} />
    </TrackingShell>
  );
}
