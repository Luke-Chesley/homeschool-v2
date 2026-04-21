"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  saveComplianceEvaluationAction,
  updateComplianceTaskAction,
} from "@/app/(parent)/tracking/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackingDashboard } from "@/lib/tracking/types";

function inputClassName() {
  return "field-shell h-11 rounded-2xl px-4 text-sm shadow-none";
}

export function RequirementsSection({ dashboard }: { dashboard: TrackingDashboard }) {
  const router = useRouter();
  const [pendingTaskId, setPendingTaskId] = React.useState<string | null>(null);
  const [evaluationError, setEvaluationError] = React.useState<string | null>(null);
  const [evaluationMessage, setEvaluationMessage] = React.useState<string | null>(null);
  const visibleTasks = dashboard.complianceTasks.filter((task) => task.status !== "not_applicable");
  const hiddenTaskCount = dashboard.complianceTasks.length - visibleTasks.length;

  async function updateTask(taskId: string, status: "completed" | "not_applicable" | "ready") {
    setPendingTaskId(taskId);
    await updateComplianceTaskAction({ taskId, status });
    setPendingTaskId(null);
    router.refresh();
  }

  async function handleEvaluationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvaluationError(null);
    setEvaluationMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const evaluationType = formData.get("evaluationType");
    const resultSummary = formData.get("resultSummary");
    const evaluatorName = formData.get("evaluatorName");
    const evaluatorRole = formData.get("evaluatorRole");

    if (
      evaluationType !== "parent_summary" &&
      evaluationType !== "teacher_letter" &&
      evaluationType !== "standardized_test" &&
      evaluationType !== "portfolio_review" &&
      evaluationType !== "external_assessment"
    ) {
      setEvaluationError("Choose an evaluation type first.");
      return;
    }

    if (typeof resultSummary !== "string") {
      setEvaluationError("Add a summary for the evaluation record.");
      return;
    }

    const result = await saveComplianceEvaluationAction({
      evaluationType,
      resultSummary,
      evaluatorName: typeof evaluatorName === "string" ? evaluatorName : null,
      evaluatorRole: typeof evaluatorRole === "string" ? evaluatorRole : null,
      status: "completed",
    });

    if (!result.ok) {
      setEvaluationError(result.error ?? "Could not save the evaluation record.");
      return;
    }

    form.reset();
    setEvaluationMessage("Evaluation record saved.");
    router.refresh();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
          <CardDescription>
            Track deadlines, missing items, and what already looks ready without pretending the app filed anything for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleTasks.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-sm text-muted-foreground">
              No generated tasks yet. Save the tracking setup first.
            </div>
          ) : (
            visibleTasks.map((task) => (
              <div key={task.id} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Due {task.dueDate} · {task.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.status !== "completed" ? (
                      <Button
                        size="sm"
                        onClick={() => updateTask(task.id, "completed")}
                        disabled={pendingTaskId === task.id}
                        className="rounded-full"
                      >
                        {pendingTaskId === task.id ? "Saving..." : "Mark complete"}
                      </Button>
                    ) : null}
                    {task.status !== "not_applicable" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateTask(task.id, "not_applicable")}
                        disabled={pendingTaskId === task.id}
                        className="rounded-full"
                      >
                        {pendingTaskId === task.id ? "Saving..." : "Not applicable"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {task.notes ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{task.notes}</p> : null}
              </div>
            ))
          )}
          {hiddenTaskCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {hiddenTaskCount} not-applicable task{hiddenTaskCount === 1 ? "" : "s"} hidden.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>Annual evaluation record</CardTitle>
          <CardDescription>
            Store the chosen evaluation or testing proof even if the final document lives outside the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={handleEvaluationSubmit}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="evaluation-type">
                Evaluation type
              </label>
              <select id="evaluation-type" name="evaluationType" className={inputClassName()} defaultValue="parent_summary">
                <option value="parent_summary">Parent summary</option>
                <option value="teacher_letter">Teacher letter</option>
                <option value="standardized_test">Standardized test</option>
                <option value="portfolio_review">Portfolio review</option>
                <option value="external_assessment">External assessment</option>
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="evaluator-name">
                  Evaluator name
                </label>
                <input id="evaluator-name" name="evaluatorName" className={inputClassName()} placeholder="Optional" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="evaluator-role">
                  Evaluator role
                </label>
                <input id="evaluator-role" name="evaluatorRole" className={inputClassName()} placeholder="Optional" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="evaluation-summary">
                Summary
              </label>
              <textarea id="evaluation-summary" name="resultSummary" rows={4} className="field-shell-textarea min-h-28 rounded-2xl px-4 py-3 text-sm shadow-none" placeholder="What does this evaluation or proof show?" />
            </div>

            <Button type="submit" className="rounded-full">Save evaluation record</Button>
            {evaluationMessage ? <p className="text-sm text-muted-foreground">{evaluationMessage}</p> : null}
            {evaluationError ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{evaluationError}</p>
            ) : null}
          </form>

          <div className="space-y-3">
            {dashboard.evaluationRecords.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-sm text-muted-foreground">
                No annual evaluation record has been saved yet.
              </div>
            ) : (
              dashboard.evaluationRecords.map((record) => (
                <div key={record.id} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                  <p className="font-medium text-foreground">{record.evaluationType.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {record.completedAt ? `Completed ${record.completedAt.slice(0, 10)}` : "Draft"} · {record.status}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{record.resultSummary}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
