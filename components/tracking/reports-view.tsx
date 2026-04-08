import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  HomeschoolMonthlySummary,
  HomeschoolTranscriptSkeleton,
  HomeschoolWeeklySummary,
} from "@/lib/homeschool/reporting/types";
import { getTrackingExportPreview } from "@/lib/tracking/service";
import type { TrackingDashboard } from "@/lib/tracking/types";
import { cn } from "@/lib/utils";

export function ReportsView({
  dashboard,
  weeklySummary,
  monthlySummary,
  transcript,
}: {
  dashboard: TrackingDashboard;
  weeklySummary: HomeschoolWeeklySummary;
  monthlySummary: HomeschoolMonthlySummary;
  transcript: HomeschoolTranscriptSkeleton;
}) {
  const exports = getTrackingExportPreview(dashboard);
  const objectiveCount = dashboard.standards.length;
  const evidenceCount = dashboard.evidence.length;
  const openReviews = dashboard.reviewQueue.length;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Objective rows</CardDescription>
            <CardTitle className="text-4xl">{objectiveCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Evidence records</CardDescription>
            <CardTitle className="text-4xl">{evidenceCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Open reviews</CardDescription>
            <CardTitle className="text-4xl">{openReviews}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Weekly summary</CardTitle>
            <CardDescription>
              A parent-facing recap of what moved forward, what slipped, and whether the week stayed workable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Completed</p>
                <p className="mt-2 text-sm font-semibold">{weeklySummary.completedCount}</p>
              </div>
              <div className="rounded-2xl bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Partial</p>
                <p className="mt-2 text-sm font-semibold">{weeklySummary.partialCount}</p>
              </div>
              <div className="rounded-2xl bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Skipped</p>
                <p className="mt-2 text-sm font-semibold">{weeklySummary.skippedCount}</p>
              </div>
              <div className="rounded-2xl bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attendance days</p>
                <p className="mt-2 text-sm font-semibold">{weeklySummary.attendanceCount}</p>
              </div>
            </div>
            <p className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              {weeklySummary.narrative}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly summary</CardTitle>
            <CardDescription>
              A compact records view for attendance and completed work across the last month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attendance rate</p>
              <p className="mt-2 text-3xl font-semibold">{monthlySummary.attendanceRate}%</p>
            </div>
            <div className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Lessons completed</p>
              <p className="mt-2 text-3xl font-semibold">
                {monthlySummary.completedLessonCount}/{monthlySummary.totalLessonCount}
              </p>
            </div>
            <div className="space-y-2">
              {monthlySummary.subjectBreakdown.map((entry) => (
                <div key={entry.subject} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm">
                  <span>{entry.subject}</span>
                  <Badge variant="outline">{entry.count} lessons</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Progress export preview</CardTitle>
            <CardDescription>
              Export rows are shaped for CSV or records without forcing feature code to know the table format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {exports.lessonRows.map((row) => (
              <div key={`${row.date}-${row.lesson}`} className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{row.lesson}</p>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.date} · {row.subject} · {row.actualMinutes}/{row.plannedMinutes} minutes
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {row.standards || "No objectives linked"} · {row.goals || "No goals linked"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transcript skeleton</CardTitle>
            <CardDescription>
              Older learners can start from a legible subject-level skeleton instead of a blank document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {transcript.learnerName} · {transcript.gradeLabel}
              </p>
            </div>
            {transcript.entries.map((entry) => (
              <div key={entry.subject} className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{entry.courseTitle}</p>
                  <Badge variant="outline">{entry.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.subject} · {entry.evidenceCount} lesson records
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap gap-2">
        <a
          href="/api/homeschool/reports/export?kind=progress_report"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Export progress report
        </a>
        <a
          href="/api/homeschool/reports/export?kind=attendance_log"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Export attendance log
        </a>
        <a
          href="/api/homeschool/reports/export?kind=transcript_skeleton"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Export transcript skeleton
        </a>
      </section>
    </div>
  );
}
