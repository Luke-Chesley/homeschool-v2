import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTrackingExportPreview } from "@/lib/tracking/service";
import type { TrackingDashboard } from "@/lib/tracking/types";

export function ReportsView({ dashboard }: { dashboard: TrackingDashboard }) {
  const exports = getTrackingExportPreview();

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Standards coverage and gaps</CardTitle>
            <CardDescription>
              Coverage tracks both completed evidence and visible gaps, instead of only counting planned exposure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.standards.map((standard) => (
              <div
                key={standard.id}
                className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{standard.code}</p>
                      <Badge variant="outline">{standard.subject}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{standard.label}</p>
                  </div>
                  <Badge className="bg-card text-foreground">{standard.status.replace("_", " ")}</Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-card px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Evidence count</p>
                    <p className="mt-2 text-sm font-semibold">{standard.evidenceCount}</p>
                  </div>
                  <div className="rounded-2xl bg-card px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest evidence</p>
                    <p className="mt-2 text-sm font-semibold">{standard.latestEvidence}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Goal progress</CardTitle>
            <CardDescription>
              Household goals and formal standards stay visible in the same reporting flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.goals.map((goal) => (
              <div key={goal.id} className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{goal.title}</p>
                  <Badge variant="outline">{goal.subject}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{goal.progressLabel}</p>
                <p className="mt-3 text-sm font-medium">{goal.nextMove}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {goal.linkedStandards.map((standard) => (
                    <Badge key={standard}>{standard}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Lesson export preview</CardTitle>
            <CardDescription>
              Export rows are shaped for CSV or parent records without forcing feature code to know the table format.
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
                  {row.standards || "No standards linked"} · {row.goals || "No goals linked"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Standards export preview</CardTitle>
            <CardDescription>
              Compact rows for coverage reports, compliance snapshots, and organizational summaries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {exports.standardRows.map((row) => (
              <div key={row.code} className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{row.code}</p>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.subject} · {row.evidenceCount} evidence items
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{row.latestEvidence}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
