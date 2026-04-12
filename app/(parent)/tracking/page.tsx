import { redirect } from "next/navigation";

import { TrackingOverview, TrackingShell } from "@/components/tracking";
import { requireAppSession } from "@/lib/app-session/server";
import { getRecentHomeschoolAttendance } from "@/lib/homeschool/attendance/service";
import {
  getTrackingDashboard,
  updateRecommendationDecision,
} from "@/lib/tracking/service";

export const metadata = {
  title: "Tracking",
};

interface TrackingPageProps {
  searchParams: Promise<{
    action?: string | string[];
    recommendationId?: string | string[];
  }>;
}

export default async function TrackingPage({ searchParams }: TrackingPageProps) {
  const session = await requireAppSession();
  const resolvedSearchParams = await searchParams;
  const action =
    typeof resolvedSearchParams.action === "string"
      ? resolvedSearchParams.action
      : undefined;
  const recommendationId =
    typeof resolvedSearchParams.recommendationId === "string"
      ? resolvedSearchParams.recommendationId
      : undefined;

  if (
    recommendationId &&
    (action === "accept" || action === "override")
  ) {
    await updateRecommendationDecision({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      recommendationId,
      action,
    });
    redirect("/tracking");
  }

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
      title="Keep objectives, evidence, and progress in one place."
      description="Tracking should stay practical: what was planned, what happened, and what still needs review or adjustment."
    >
      <TrackingOverview
        dashboard={dashboard}
        attendanceRecords={attendanceRecords}
        todayDate={new Date().toISOString().slice(0, 10)}
      />
    </TrackingShell>
  );
}
