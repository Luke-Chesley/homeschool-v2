import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes, formatOutcomeDelta, formatTrackingDate } from "@/lib/tracking/service";
import type { TrackingDashboard } from "@/lib/tracking/types";

const masteryTone: Record<string, string> = {
  secure: "bg-secondary/18 text-secondary-foreground",
  developing: "bg-primary/10 text-foreground",
  emerging: "bg-amber-100 text-amber-900",
  needs_review: "bg-destructive/10 text-destructive",
};

const statusTone: Record<string, string> = {
  completed: "text-secondary-foreground",
  partial: "text-amber-800",
  skipped: "text-destructive",
};

export function TrackingOverview({ dashboard }: { dashboard: TrackingDashboard }) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardDescription>{dashboard.learner.reportingWindow}</CardDescription>
            <CardTitle>{dashboard.learner.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-7 text-muted-foreground">
            <p>{dashboard.learner.gradeLabel}</p>
            <p>
              Planned versus actual stays visible here so reporting doesn&apos;t flatten out real
              family days.
            </p>
          </CardContent>
        </Card>

        <MetricCard label="Completion rate" value={`${dashboard.summary.completionRate}%`} />
        <MetricCard label="Actual time" value={formatMinutes(dashboard.summary.actualMinutes)} />
        <MetricCard label="Needs attention" value={`${dashboard.summary.needsAttentionCount}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Completion history</CardTitle>
            <CardDescription>
              Planned, actual, mastery, and evidence stay in the same row so recovery decisions
              stay grounded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.outcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{outcome.title}</p>
                      <Badge variant="outline">{outcome.subject}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTrackingDate(outcome.date)} · {formatMinutes(outcome.plannedMinutes)} planned
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={masteryTone[outcome.mastery]}>{outcome.mastery.replace("_", " ")}</Badge>
                    <span className={`text-sm font-medium ${statusTone[outcome.status]}`}>
                      {outcome.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <StatBlock label="Actual time" value={formatMinutes(outcome.actualMinutes)} />
                  <StatBlock label="Delta" value={formatOutcomeDelta(outcome.plannedMinutes, outcome.actualMinutes)} />
                  <StatBlock label="Evidence" value={`${outcome.evidenceCount} linked items`} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {outcome.standards.map((standard) => (
                    <Badge key={standard} variant="outline">
                      {standard}
                    </Badge>
                  ))}
                  {outcome.goals.map((goal) => (
                    <Badge key={goal} className="bg-card text-foreground">
                      {goal}
                    </Badge>
                  ))}
                </div>

                {outcome.deviationNote ? (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{outcome.deviationNote}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Observation feed</CardTitle>
              <CardDescription>
                Notes stay lightweight but still anchor to specific outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.observations.map((observation) => (
                <div
                  key={observation.id}
                  className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{observation.title}</p>
                    <Badge variant="outline">{observation.tone.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTrackingDate(observation.date)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{observation.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence ledger</CardTitle>
              <CardDescription>
                Export-friendly records for work samples, notes, and activity outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.evidence.map((item) => (
                <div key={item.id} className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{item.title}</p>
                    <Badge variant="outline">{item.kind}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.linkedTo} · {item.capturedAt}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-4xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
