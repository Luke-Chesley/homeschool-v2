import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatMinutes,
  formatOutcomeDelta,
  formatTrackingDate,
} from "@/lib/tracking/service";
import type { TrackingDashboard } from "@/lib/tracking/types";
import { getLessonEvaluationLabel } from "@/lib/session-workspace/evaluation";

const masteryTone: Record<string, string> = {
  secure: "bg-secondary/18 text-secondary-foreground",
  developing: "bg-primary/10 text-foreground",
  emerging: "bg-amber-100 text-amber-900",
  needs_review: "bg-destructive/10 text-destructive",
};

const evaluationTone: Record<string, string> = {
  needs_more_work: "border-destructive/20 bg-destructive/10 text-destructive",
  partial: "border-amber-200 bg-amber-50 text-amber-900",
  successful: "border-secondary/20 bg-secondary/18 text-secondary-foreground",
  exceeded: "border-primary/20 bg-primary/10 text-primary",
};

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2 leading-6">{body}</p>
    </div>
  );
}

export function ProgressSection({ dashboard }: { dashboard: TrackingDashboard }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="grid gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Progress snapshots</CardTitle>
            <CardDescription>
              Quarterly and annual narrative drafts stay tied to actual work instead of separate paperwork.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {dashboard.progressSnapshots.length === 0 ? (
              <EmptyState
                title="No progress snapshots yet"
                body="Snapshots will appear once work is recorded or a draft is saved on the reports page."
              />
            ) : (
              dashboard.progressSnapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{snapshot.periodLabel}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        {snapshot.periodType} · {snapshot.status}
                      </p>
                    </div>
                    <Badge variant="outline">{snapshot.evidenceRefs.length} refs</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{snapshot.summaryText}</p>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Strengths:</span> {snapshot.strengths}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Needs more proof:</span> {snapshot.struggles}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Next steps:</span> {snapshot.nextSteps}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Subject coverage</CardTitle>
            <CardDescription>
              Coverage stays soft-signal based: useful for readiness, not a hard legal certification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.subjectCoverage.length === 0 ? (
              <EmptyState
                title="No subject coverage yet"
                body="Coverage fills in as lesson outcomes and evidence records accumulate."
              />
            ) : (
              dashboard.subjectCoverage.map((row) => (
                <div key={row.subjectKey} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{row.label}</p>
                    <Badge variant="outline">{row.coverageStatus.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {row.minutesLogged} minutes · {row.daysTouched} days touched · {row.unitsTouched} recorded items
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Outcome history</CardTitle>
            <CardDescription>See what was planned, what happened, and what now supports the record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.outcomes.length === 0 ? (
              <EmptyState
                title="No recorded outcomes yet"
                body="Complete or partially complete work from Today to start the tracking record."
              />
            ) : (
              dashboard.outcomes.map((outcome) => (
                <div key={outcome.id} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{outcome.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTrackingDate(outcome.date)} · {outcome.subject}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={masteryTone[outcome.mastery]}>{outcome.mastery.replaceAll("_", " ")}</Badge>
                      <Badge variant="outline">{outcome.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-muted-foreground">
                      Actual: {formatMinutes(outcome.actualMinutes)}
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-muted-foreground">
                      {formatOutcomeDelta(outcome.plannedMinutes, outcome.actualMinutes)}
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-muted-foreground">
                      {outcome.evidenceCount} evidence items
                    </div>
                  </div>
                  {outcome.deviationNote ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{outcome.deviationNote}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Lesson evaluations</CardTitle>
            <CardDescription>Quick lesson-level reads that help later snapshots feel grounded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.evaluations.length === 0 ? (
              <EmptyState
                title="No lesson evaluations yet"
                body="Rate a lesson from Today when you want a stronger narrative trail."
              />
            ) : (
              dashboard.evaluations.map((evaluation) => (
                <div key={evaluation.id} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{evaluation.title}</p>
                    <Badge variant="outline" className={evaluationTone[evaluation.level]}>
                      {getLessonEvaluationLabel(evaluation.level)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatTrackingDate(evaluation.date)}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{evaluation.note}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Observations and recommendations</CardTitle>
            <CardDescription>Keep the narrative trail close to the work, not in a separate memo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.observations.length === 0 && dashboard.recommendations.length === 0 ? (
              <EmptyState
                title="No observation trail yet"
                body="Observation notes and recommendations will appear once work starts generating them."
              />
            ) : (
              <>
                {dashboard.observations.map((observation) => (
                  <div key={observation.id} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{observation.title}</p>
                      <Badge variant="outline">{observation.tone.replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTrackingDate(observation.date)}</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{observation.body}</p>
                  </div>
                ))}

                {dashboard.recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{recommendation.title}</p>
                      <Badge variant="outline">{recommendation.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.description}</p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
