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
      title="Progress and records"
      description="Review progress, evidence, attendance, and follow-up items without leaving the working context."
    >
      <TrackingOverview
        dashboard={dashboard}
        attendanceRecords={attendanceRecords}
        todayDate={new Date().toISOString().slice(0, 10)}
      />
    </TrackingShell>
  );
}
