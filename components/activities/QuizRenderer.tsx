"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type QuizActivity = Extract<ActivityDefinition, { kind: "quiz" }>;

interface Props {
  activity: QuizActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[]) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
}

export function QuizRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
}: Props) {
  const [answers, setAnswers] = React.useState<AttemptAnswer[]>(initialAnswers);
  const [shownHints, setShownHints] = React.useState<Set<string>>(new Set());

  function getAnswer(questionId: string): string | undefined {
    return answers.find((a) => a.questionId === questionId)?.value as string | undefined;
  }

  function setAnswer(questionId: string, value: string) {
    const next = answers.filter((a) => a.questionId !== questionId);
    const updated = [...next, { questionId, value }];
    setAnswers(updated);
    onAnswerChange?.(updated);
  }

  function toggleHint(questionId: string) {
    setShownHints((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  const answered = answers.length;
  const total = activity.questions.length;

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
        {activity.questions.map((question, qi) => {
          const isAnswered = !!getAnswer(question.id);
          const showHint = shownHints.has(question.id);

          return (
            <div
              key={question.id}
              className="rounded-xl border border-border/70 bg-card/80 p-5 flex flex-col gap-3"
            >
              {/* Question prompt */}
              <div className="flex items-start gap-2">
                <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                  {qi + 1}
                </span>
                <p className="text-sm font-medium leading-relaxed">
                  {question.prompt.text}
                </p>
              </div>

              {/* Multiple choice */}
              {question.kind === "multiple_choice" && (
                <div className="flex flex-col gap-2 pl-7">
                  {question.choices.map((choice) => {
                    const selected = getAnswer(question.id) === choice.id;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswer(question.id, choice.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary/8 text-primary font-medium"
                            : "border-border bg-card/60 hover:bg-muted/60"
                        )}
                      >
                        <span
                          className={cn(
                            "size-4 shrink-0 rounded-full border transition-colors",
                            selected ? "border-primary bg-primary" : "border-border"
                          )}
                        />
                        {choice.text}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Short answer */}
              {question.kind === "short_answer" && (
                <div className="pl-7">
                  <textarea
                    value={(getAnswer(question.id) as string) ?? ""}
                    onChange={(e) => setAnswer(question.id, e.target.value)}
                    disabled={submitted}
                    rows={3}
                    placeholder="Write your answer here…"
                    className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              )}

              {/* Hint */}
              {"hint" in question && question.hint && (
                <div className="pl-7">
                  <button
                    type="button"
                    onClick={() => toggleHint(question.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="size-3.5" />
                    {showHint ? "Hide hint" : "Show hint"}
                  </button>
                  {showHint && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      {question.hint}
                    </p>
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
