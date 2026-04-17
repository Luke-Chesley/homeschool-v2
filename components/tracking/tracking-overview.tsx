import { applyTrackingRecommendationAction } from "@/app/(parent)/tracking/actions";
import { AttendanceCard } from "@/components/tracking/attendance-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HomeschoolAttendanceRecord } from "@/lib/homeschool/attendance/types";
import {
  formatMinutes,
  formatOutcomeDelta,
  formatTrackingDate,
} from "@/lib/tracking/service";
import type { TrackingDashboard } from "@/lib/tracking/types";
import { getLessonEvaluationLabel } from "@/lib/session-workspace/evaluation";
import { cn } from "@/lib/utils";

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

const evaluationTone: Record<string, string> = {
  needs_more_work: "border-destructive/20 bg-destructive/10 text-destructive",
  partial: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  successful: "border-secondary/20 bg-secondary/18 text-secondary-foreground",
  exceeded: "border-primary/20 bg-primary/10 text-primary",
};

export function TrackingOverview({
  dashboard,
  attendanceRecords,
  todayDate,
}: {
  dashboard: TrackingDashboard;
  attendanceRecords: HomeschoolAttendanceRecord[];
  todayDate: string;
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="quiet-panel lg:col-span-2">
          <CardHeader>
            <CardDescription>{dashboard.learner.reportingWindow}</CardDescription>
            <CardTitle>{dashboard.learner.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-7 text-muted-foreground">
            <p>{dashboard.learner.gradeLabel}</p>
            {dashboard.curriculum ? (
              <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">Live curriculum</p>
                <p className="font-semibold text-foreground">{dashboard.curriculum.sourceTitle}</p>
                <p className="text-sm leading-6">
                  {dashboard.curriculum.selectionReason}
                  {dashboard.curriculum.weekStartDate
                    ? ` · week of ${dashboard.curriculum.weekStartDate}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{dashboard.curriculum.totalSkillCount} skills</Badge>
                  <Badge variant="outline">{dashboard.curriculum.scheduledItemCount} planned items</Badge>
                </div>
              </div>
            ) : null}
            <p>Use this view to keep progress, evidence, and review decisions anchored to real work.</p>
          </CardContent>
        </Card>

        <MetricCard label="Completion rate" value={`${dashboard.summary.completionRate}%`} />
        <MetricCard label="Actual time" value={formatMinutes(dashboard.summary.actualMinutes)} />
        <MetricCard label="Needs attention" value={`${dashboard.summary.needsAttentionCount}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="quiet-panel">
          <CardHeader>
            <CardTitle>Progress history</CardTitle>
            <CardDescription>See what was planned, what happened, and what was recorded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.outcomes.length === 0 ? (
              <TrackingEmptyState
                title="No curriculum-linked outcomes yet"
                body={
                  dashboard.curriculum
                    ? `${dashboard.curriculum.sourceTitle} is active for this learner, but no progress has been recorded yet.`
                    : "No progress has been recorded for this learner yet."
                }
              />
            ) : (
              dashboard.outcomes.map((outcome) => (
                <div key={outcome.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
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
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="quiet-panel">
            <CardHeader>
              <CardTitle>Observations</CardTitle>
              <CardDescription>Short notes tied to real work and progress events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.observations.length === 0 ? (
                <TrackingEmptyState
                  title="No observation notes yet"
                  body="Observation notes will appear here once they are attached to this learner's work."
                />
              ) : (
                dashboard.observations.map((observation) => (
                  <div key={observation.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{observation.title}</p>
                      <Badge variant="outline">{observation.tone.replace("_", " ")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTrackingDate(observation.date)}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{observation.body}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="quiet-panel">
            <CardHeader>
              <CardTitle>Lesson evaluations</CardTitle>
              <CardDescription>Quick lesson-level signals for later review and planning decisions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.evaluations.length === 0 ? (
                <TrackingEmptyState
                  title="No lesson evaluations yet"
                  body="Lesson evaluations will appear here once a lesson card is rated from Today."
                />
              ) : (
                dashboard.evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{evaluation.title}</p>
                      <Badge variant="outline" className={evaluationTone[evaluation.level]}>
                        {getLessonEvaluationLabel(evaluation.level)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTrackingDate(evaluation.date)}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{evaluation.note}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="quiet-panel">
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
              <CardDescription>Work samples, notes, and activity outcomes in one record stream.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.evidence.length === 0 ? (
                <TrackingEmptyState
                  title="No evidence linked yet"
                  body={
                    dashboard.curriculum
                      ? `${dashboard.curriculum.scheduledItemCount} planned items are currently in scope for ${dashboard.curriculum.sourceTitle}. Evidence will appear here once work is recorded.`
                      : "Evidence will appear here once work samples, notes, or outcomes are captured."
                  }
                />
              ) : (
                dashboard.evidence.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{item.title}</p>
                      <Badge variant="outline">{item.kind}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.linkedTo} · {item.capturedAt}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.note}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="quiet-panel">
            <CardHeader>
              <CardTitle>Review queue</CardTitle>
              <CardDescription>Items waiting on an adult decision stay visible here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.reviewQueue.length === 0 ? (
                <TrackingEmptyState
                  title="Nothing is waiting for review"
                  body="Review requests will collect here when work needs another adult decision."
                />
              ) : (
                dashboard.reviewQueue.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold capitalize">{item.subjectType.replace("_", " ")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Needs an adult decision before it closes.
                        </p>
                      </div>
                      <Badge variant="outline">{item.state.replace("_", " ")}</Badge>
                    </div>
                    {item.dueAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Due {formatTrackingDate(item.dueAt.slice(0, 10))}
                      </p>
                    ) : null}
                    {item.decisionSummary ? (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {item.decisionSummary}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <AttendanceCard todayDate={todayDate} records={attendanceRecords} />

          <Card className="quiet-panel">
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
              <CardDescription>Suggested next moves stay reviewable before they change the plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.recommendations.length === 0 ? (
                <TrackingEmptyState
                  title="No recommendations yet"
                  body="Suggested next moves will appear here when the learner's recent work points to one."
                />
              ) : (
                dashboard.recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{recommendation.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {recommendation.recommendationType.replace("_", " ")}
                        </p>
                      </div>
                      <Badge variant="outline">{recommendation.status}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {recommendation.description}
                    </p>
                    {recommendation.status === "proposed" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <RecommendationDecisionButton
                          recommendationId={recommendation.id}
                          action="accept"
                          label="Accept"
                        />
                        <RecommendationDecisionButton
                          recommendationId={recommendation.id}
                          action="override"
                          label="Keep current plan"
                          variant="outline"
                        />
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function RecommendationDecisionButton({
  recommendationId,
  action,
  label,
  variant,
}: {
  recommendationId: string;
  action: "accept" | "override";
  label: string;
  variant?: "default" | "outline";
}) {
  return (
    <form action={applyTrackingRecommendationAction}>
      <input type="hidden" name="recommendationId" value={recommendationId} />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className={cn(buttonVariants({ size: "sm", variant }))}
      >
        {label}
      </button>
    </form>
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

function TrackingEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-border/80 bg-muted/30 p-5">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}
