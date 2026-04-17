import { TrackingOverview, TrackingShell } from "@/components/tracking";
import { requireAppSession } from "@/lib/app-session/server";
import { getRecentHomeschoolAttendance } from "@/lib/homeschool/attendance/service";
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
  const attendanceRecords = await getRecentHomeschoolAttendance({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
  });

  return (
    <TrackingShell
      currentView="overview"
      title="Progress and records"
      description="See what was planned, what happened, and what was recorded."
    >
      <TrackingOverview
        dashboard={dashboard}
        attendanceRecords={attendanceRecords}
        todayDate={new Date().toISOString().slice(0, 10)}
      />
    </TrackingShell>
  );
}
