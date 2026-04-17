import { TrackingOverview, TrackingShell } from "@/components/tracking";
import { requireAppSession } from "@/lib/app-session/server";
import { listRequirementProfiles } from "@/lib/compliance/profiles";
import { getTrackingDashboard } from "@/lib/tracking/service";

export const metadata = {
  title: "Tracking",
};

export default async function TrackingPage() {
  const session = await requireAppSession();

  const dashboard = await getTrackingDashboard({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
  });
  const profileOptions = listRequirementProfiles();

  return (
    <TrackingShell
      currentView="overview"
      title="Attendance, progress, portfolio, and deadlines"
      description="Keep one operational record, then shape it into the summaries and export packs your learner-year profile needs."
    >
      <TrackingOverview
        dashboard={dashboard}
        profileOptions={profileOptions}
        todayDate={new Date().toISOString().slice(0, 10)}
      />
    </TrackingShell>
  );
}
