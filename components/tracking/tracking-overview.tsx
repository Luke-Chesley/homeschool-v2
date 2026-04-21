import { AttendanceCard } from "@/components/tracking/attendance-card";
import { PortfolioSection } from "@/components/tracking/portfolio-section";
import { ProgressSection } from "@/components/tracking/progress-section";
import { ProgramSetupCard } from "@/components/tracking/program-setup-card";
import { RequirementsSection } from "@/components/tracking/requirements-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { ProgressStat } from "@/components/ui/progress-stat";
import type { RequirementProfile } from "@/lib/compliance/types";
import { formatMinutes } from "@/lib/tracking/service";
import type { TrackingDashboard } from "@/lib/tracking/types";

export function TrackingOverview({
  dashboard,
  profileOptions,
  todayDate,
}: {
  dashboard: TrackingDashboard;
  profileOptions: RequirementProfile[];
  todayDate: string;
}) {
  const openTaskCount = dashboard.complianceTasks.filter(
    (task) => task.status !== "completed" && task.status !== "not_applicable",
  ).length;
  const attendanceProgress =
    dashboard.attendance.summary.targetHours && dashboard.attendance.summary.targetHours > 0
      ? dashboard.attendance.summary.instructionalHours / dashboard.attendance.summary.targetHours
      : dashboard.attendance.summary.targetDays && dashboard.attendance.summary.targetDays > 0
        ? dashboard.attendance.summary.loggedInstructionalDays / dashboard.attendance.summary.targetDays
        : null;
  const completionRate = Math.max(0, Math.min(1, dashboard.summary.completionRate));

  return (
    <div className="grid gap-6">
      <section className="dashboard-grid">
        <Card variant="glass" className="overflow-hidden">
          <CardContent className="space-y-5 pt-6 text-sm leading-6 text-muted-foreground">
            <div className="space-y-2">
              <p className="section-meta">{dashboard.learner.reportingWindow}</p>
              <h2 className="font-serif text-[2rem] leading-tight tracking-[-0.03em] text-foreground">
                {dashboard.learner.name}
              </h2>
            </div>
            <p>{dashboard.learner.gradeLabel}</p>
            {dashboard.program ? (
              <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {dashboard.program.jurisdictionLabel} · {dashboard.program.pathwayLabel}
                  </p>
                  <Badge variant="outline">{dashboard.program.schoolYearLabel}</Badge>
                </div>
                <p className="mt-2">{dashboard.program.framingNote}</p>
              </div>
            ) : null}
            {dashboard.curriculum ? (
              <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                <p className="font-medium text-foreground">{dashboard.curriculum.sourceTitle}</p>
                <p className="mt-1">
                  {dashboard.curriculum.selectionReason}
                  {dashboard.curriculum.weekStartDate
                    ? ` · week of ${dashboard.curriculum.weekStartDate}`
                    : ""}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <ProgressStat
            label="Attendance progress"
            value={dashboard.attendance.summary.progressLabel}
            caption={
              attendanceProgress == null
                ? "Add or choose a requirement profile to unlock target-based attendance progress."
                : dashboard.attendance.summary.readinessLabel
            }
            progress={attendanceProgress ?? 0}
          />
          <ProgressStat
            label="Completed work"
            value={`${Math.round(completionRate * 100)}%`}
            caption={`${dashboard.summary.secureCount} secure outcomes captured so far.`}
            progress={completionRate}
            tone="secondary"
          />
          <MetricCard
            label="Tracked time"
            value={formatMinutes(dashboard.summary.actualMinutes)}
            hint={`${dashboard.summary.needsAttentionCount} outcome${
              dashboard.summary.needsAttentionCount === 1 ? "" : "s"
            } still need follow-up.`}
            tone="secondary"
          />
          <MetricCard
            label="Portfolio saved"
            value={`${dashboard.portfolioSavedCount}`}
            hint={`${openTaskCount} compliance task${openTaskCount === 1 ? "" : "s"} still open.`}
          />
        </div>
      </section>

      <ProgramSetupCard program={dashboard.program} profileOptions={profileOptions} />

      <AttendanceCard
        todayDate={todayDate}
        complianceProgramId={dashboard.program?.id ?? null}
        summary={dashboard.attendance.summary}
        records={dashboard.attendance.records}
      />

      <ProgressSection dashboard={dashboard} />
      <PortfolioSection dashboard={dashboard} />
      <RequirementsSection dashboard={dashboard} />
    </div>
  );
}
