import { TrackingOverview, TrackingShell } from "@/components/tracking";
import { requireAppSession } from "@/lib/app-session/server";
import { getTrackingDashboard } from "@/lib/tracking/service";

export const metadata = {
  title: "Tracking Overview",
};

export default async function TrackingPage() {
  const session = await requireAppSession();
  const dashboard = await getTrackingDashboard({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
  });

  return (
    <TrackingShell
      currentView="overview"
      title="Tracking that keeps evidence, deviations, and progress in the same conversation."
      description="This workspace records what was planned, what actually happened, and what evidence supports the story, without collapsing family reality into a single completion checkbox."
    >
      <TrackingOverview dashboard={dashboard} />
    </TrackingShell>
  );
}
