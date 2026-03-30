"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type ReflectionActivity = Extract<ActivityDefinition, { kind: "reflection" }>;

interface Props {
  activity: ReflectionActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[]) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
}

export function ReflectionRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
}: Props) {
  const [answers, setAnswers] = React.useState<AttemptAnswer[]>(initialAnswers);

  function getAnswer(promptId: string): string | number | undefined {
    return answers.find((a) => a.questionId === promptId)?.value as string | number | undefined;
  }

  function setAnswer(promptId: string, value: string | number) {
    const next = [...answers.filter((a) => a.questionId !== promptId), { questionId: promptId, value }];
    setAnswers(next);
    onAnswerChange?.(next);
  }

  const answered = answers.filter((a) => {
    const v = a.value;
    return v !== undefined && v !== "" && v !== null;
  }).length;
  const total = activity.prompts.length;

  return (
    <ActivityShell
      title={activity.title}
      instructions={activity.instructions}
      progress={submitted ? 1 : answered / total}
      estimatedMinutes={estimatedMinutes}
      onSubmit={onSubmit ? () => onSubmit(answers) : undefined}
      submitting={submitting}
      submitted={submitted}
    >
      <div className="flex flex-col gap-6">
        {activity.prompts.map((prompt, idx) => {
          const value = getAnswer(prompt.id);

          return (
            <div key={prompt.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <span className="shrink-0 rounded-full bg-secondary/20 text-secondary-foreground text-xs font-semibold px-2 py-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm font-medium">{prompt.prompt.text}</p>
              </div>

              {prompt.responseKind === "text" && (
                <textarea
                  value={(value as string) ?? ""}
                  onChange={(e) => setAnswer(prompt.id, e.target.value)}
                  disabled={submitted}
                  rows={3}
                  placeholder="Write your reflection here…"
                  className="rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none"
                />
              )}

              {prompt.responseKind === "rating" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswer(prompt.id, rating)}
                        className={cn(
                          "size-9 rounded-full border text-sm font-medium transition-colors",
                          value === rating
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card/60 hover:bg-muted/60"
                        )}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                  {prompt.ratingLabels && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{prompt.ratingLabels[0]}</span>
                      <span>{prompt.ratingLabels[1]}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ActivityShell>
  );
}
