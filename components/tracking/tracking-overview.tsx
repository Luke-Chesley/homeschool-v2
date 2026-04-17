import { AttendanceCard } from "@/components/tracking/attendance-card";
import { PortfolioSection } from "@/components/tracking/portfolio-section";
import { ProgressSection } from "@/components/tracking/progress-section";
import { ProgramSetupCard } from "@/components/tracking/program-setup-card";
import { RequirementsSection } from "@/components/tracking/requirements-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RequirementProfile } from "@/lib/compliance/types";
import { formatMinutes } from "@/lib/tracking/service";
import type { TrackingDashboard } from "@/lib/tracking/types";

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="quiet-panel shadow-none">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

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

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(180px,1fr))]">
        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardDescription>{dashboard.learner.reportingWindow}</CardDescription>
            <CardTitle>{dashboard.learner.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>{dashboard.learner.gradeLabel}</p>
            {dashboard.program ? (
              <div className="rounded-xl border border-border/60 bg-background/75 p-4">
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
              <div className="rounded-xl border border-border/60 bg-background/75 p-4">
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

        <MetricCard
          label="Attendance progress"
          value={dashboard.attendance.summary.progressLabel}
          hint={dashboard.attendance.summary.readinessLabel}
        />
        <MetricCard label="Tracked time" value={formatMinutes(dashboard.summary.actualMinutes)} />
        <MetricCard
          label="Saved portfolio items"
          value={`${dashboard.portfolioSavedCount}`}
          hint={`${openTaskCount} open tasks`}
        />
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
