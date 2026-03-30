"use client";

import * as React from "react";
import { HelpCircle, CheckCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type GuidedPracticeActivity = Extract<ActivityDefinition, { kind: "guided_practice" }>;

interface Props {
  activity: GuidedPracticeActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[], uiState: Record<string, unknown>) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
  initialUiState?: Record<string, unknown>;
}

export function GuidedPracticeRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
  initialUiState,
}: Props) {
  const [currentStep, setCurrentStep] = React.useState(
    typeof initialUiState?.currentStep === "number" ? initialUiState.currentStep : 0
  );
  const [answers, setAnswers] = React.useState<AttemptAnswer[]>(initialAnswers);
  const [showHints, setShowHints] = React.useState<Set<string>>(new Set());
  const [feedback, setFeedback] = React.useState<Record<string, "correct" | "wrong">>({});

  const step = activity.steps[currentStep];
  const isLastStep = currentStep === activity.steps.length - 1;

  function getAnswer(stepId: string): string {
    return (answers.find((a) => a.questionId === stepId)?.value as string) ?? "";
  }

  function setAnswer(stepId: string, value: string) {
    const next = [...answers.filter((a) => a.questionId !== stepId), { questionId: stepId, value }];
    setAnswers(next);
    onAnswerChange?.(next, { currentStep });
  }

  function checkStep() {
    const expected = step.expectedValue?.toLowerCase().trim();
    const given = getAnswer(step.id).toLowerCase().trim();
    if (!expected) {
      advanceStep();
      return;
    }
    const correct = given === expected || given.replace(/,/g, "") === expected.replace(/,/g, "");
    setFeedback((prev) => ({ ...prev, [step.id]: correct ? "correct" : "wrong" }));
    if (correct) {
      setTimeout(() => advanceStep(), 600);
    }
  }

  function advanceStep() {
    const next = currentStep + 1;
    setCurrentStep(next);
    onAnswerChange?.(answers, { currentStep: next });
  }

  function toggleHint(stepId: string) {
    setShowHints((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

  const progress = (currentStep + 1) / activity.steps.length;

  return (
    <ActivityShell
      title={activity.title}
      instructions={activity.instructions}
      progress={submitted ? 1 : progress}
      estimatedMinutes={estimatedMinutes}
      onSubmit={submitted || !isLastStep ? undefined : (onSubmit ? () => onSubmit(answers) : undefined)}
      submitting={submitting}
      submitted={submitted}
    >
      {activity.workedExample && (
        <div className="mb-6 rounded-xl bg-secondary/20 border border-secondary/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary-foreground/70 mb-2">
            Worked Example
          </p>
          <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-sans">
            {activity.workedExample.text}
          </pre>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {activity.steps.map((s, idx) => {
          const isPast = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isFuture = idx > currentStep;
          const fb = feedback[s.id];

          return (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border p-4 transition-all",
                isCurrent && "border-primary/50 bg-primary/5",
                isPast && "border-emerald-200 bg-emerald-50/50 opacity-75",
                isFuture && "border-border/40 bg-card/40 opacity-40"
              )}
            >
              <div className="flex items-start gap-2 mb-3">
                <span
                  className={cn(
                    "shrink-0 rounded-full text-xs font-semibold px-2 py-0.5",
                    isPast && "bg-emerald-100 text-emerald-700",
                    isCurrent && "bg-primary/10 text-primary",
                    isFuture && "bg-muted text-muted-foreground"
                  )}
                >
                  Step {idx + 1}
                </span>
                {isPast && <CheckCircle className="size-4 text-emerald-600 mt-0.5" />}
              </div>
              <p className="text-sm font-medium mb-3">{s.instruction.text}</p>

              {isCurrent && !submitted && (
                <div className="flex flex-col gap-2">
                  {s.expectedValue !== undefined && (
                    <input
                      value={getAnswer(s.id)}
                      onChange={(e) => setAnswer(s.id, e.target.value)}
                      placeholder="Your answer…"
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring bg-card/70",
                        fb === "correct" && "border-emerald-400",
                        fb === "wrong" && "border-red-400"
                      )}
                    />
                  )}
                  {fb === "wrong" && (
                    <p className="text-xs text-red-600">Not quite — try again.</p>
                  )}
                  {s.hint && (
                    <button
                      type="button"
                      onClick={() => toggleHint(s.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-start"
                    >
                      <HelpCircle className="size-3.5" />
                      {showHints.has(s.id) ? "Hide hint" : "Show hint"}
                    </button>
                  )}
                  {showHints.has(s.id) && s.hint && (
                    <p className="text-xs italic text-muted-foreground">{s.hint}</p>
                  )}
                  <Button
                    size="sm"
                    className="self-start"
                    onClick={checkStep}
                    disabled={s.expectedValue !== undefined && !getAnswer(s.id).trim()}
                  >
                    {isLastStep ? "Finish" : (
                      <>Next <ChevronRight className="size-4" /></>
                    )}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ActivityShell>
  );
}
