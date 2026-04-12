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
        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardDescription>Objective rows</CardDescription>
            <CardTitle className="text-3xl">{objectiveCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardDescription>Evidence records</CardDescription>
            <CardTitle className="text-3xl">{evidenceCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardDescription>Open reviews</CardDescription>
            <CardTitle className="text-3xl">{openReviews}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardTitle>Weekly summary</CardTitle>
            <CardDescription>What moved, what slipped, and whether the week stayed workable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="mt-2 text-sm font-semibold">{weeklySummary.completedCount}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-xs text-muted-foreground">Partial</p>
                <p className="mt-2 text-sm font-semibold">{weeklySummary.partialCount}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-xs text-muted-foreground">Skipped</p>
                <p className="mt-2 text-sm font-semibold">{weeklySummary.skippedCount}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                <p className="text-xs text-muted-foreground">Attendance days</p>
                <p className="mt-2 text-sm font-semibold">{weeklySummary.attendanceCount}</p>
              </div>
            </div>
            <p className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              {weeklySummary.narrative}
            </p>
          </CardContent>
        </Card>

        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardTitle>Monthly summary</CardTitle>
            <CardDescription>Attendance and completed work across the last month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs text-muted-foreground">Attendance rate</p>
              <p className="mt-2 text-3xl font-semibold">{monthlySummary.attendanceRate}%</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs text-muted-foreground">Lessons completed</p>
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
        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardTitle>Progress export preview</CardTitle>
            <CardDescription>Preview the rows that records exports will generate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {exports.lessonRows.map((row) => (
              <div key={`${row.date}-${row.lesson}`} className="rounded-xl border border-border/70 bg-background/70 p-4">
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

        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardTitle>Transcript skeleton</CardTitle>
            <CardDescription>Start from a legible subject-level record instead of a blank document.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs text-muted-foreground">
                {transcript.learnerName} · {transcript.gradeLabel}
              </p>
            </div>
            {transcript.entries.map((entry) => (
              <div key={entry.subject} className="rounded-xl border border-border/70 bg-background/70 p-4">
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
