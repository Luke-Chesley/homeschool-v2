import { ReportsView, TrackingShell } from "@/components/tracking";
import { requireAppSession } from "@/lib/app-session/server";
import {
  buildHomeschoolMonthlySummary,
  buildHomeschoolTranscriptSkeleton,
  buildHomeschoolWeeklySummary,
} from "@/lib/homeschool/reporting/service";
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
  const [weeklySummary, monthlySummary, transcript] = await Promise.all([
    buildHomeschoolWeeklySummary({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      dashboard,
    }),
    buildHomeschoolMonthlySummary({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      dashboard,
    }),
    buildHomeschoolTranscriptSkeleton({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      dashboard,
    }),
  ]);

  return (
    <TrackingShell
      currentView="reports"
      title="Reports that surface coverage, evidence, and next moves."
      description="Use the reporting view to connect objective coverage, evidence, and progress in one export-friendly record set."
    >
      <ReportsView
        dashboard={dashboard}
        weeklySummary={weeklySummary}
        monthlySummary={monthlySummary}
        transcript={transcript}
      />
    </TrackingShell>
  );
}
