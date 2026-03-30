"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type MatchingActivity = Extract<ActivityDefinition, { kind: "matching" }>;

interface Props {
  activity: MatchingActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[]) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
}

export function MatchingRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
}: Props) {
  const shuffledAnswers = React.useMemo(
    () => [...activity.pairs].sort(() => Math.random() - 0.5),
    [activity.pairs]
  );

  const [selections, setSelections] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const ans of initialAnswers) {
      init[ans.questionId] = ans.value as string;
    }
    return init;
  });
  const [selectedPrompt, setSelectedPrompt] = React.useState<string | null>(null);

  function buildAnswers(sels: Record<string, string>): AttemptAnswer[] {
    return Object.entries(sels).map(([promptId, answerId]) => ({
      questionId: promptId,
      value: answerId,
      correct: activity.pairs.find((p) => p.id === promptId)?.id === answerId,
    }));
  }

  function handlePromptClick(pairId: string) {
    if (submitted) return;
    setSelectedPrompt(pairId === selectedPrompt ? null : pairId);
  }

  function handleAnswerClick(answerId: string) {
    if (submitted || !selectedPrompt) return;
    const next = { ...selections, [selectedPrompt]: answerId };
    setSelections(next);
    setSelectedPrompt(null);
    onAnswerChange?.(buildAnswers(next));
  }

  const matchedCount = Object.keys(selections).length;
  const total = activity.pairs.length;

  const isCorrect = (promptId: string) =>
    selections[promptId] === promptId;

  return (
    <ActivityShell
      title={activity.title}
      instructions={activity.instructions ?? "Click a prompt, then click its matching answer."}
      progress={submitted ? 1 : matchedCount / total}
      estimatedMinutes={estimatedMinutes}
      onSubmit={onSubmit ? () => onSubmit(buildAnswers(selections)) : undefined}
      submitting={submitting}
      submitted={submitted}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Prompts
          </p>
          {activity.pairs.map((pair) => {
            const isSelected = selectedPrompt === pair.id;
            const matched = selections[pair.id] !== undefined;
            const correct = submitted && isCorrect(pair.id);
            const wrong = submitted && matched && !isCorrect(pair.id);

            return (
              <button
                key={pair.id}
                type="button"
                disabled={submitted}
                onClick={() => handlePromptClick(pair.id)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  isSelected && "border-primary bg-primary/8 text-primary font-medium",
                  !isSelected && matched && !submitted && "border-secondary/50 bg-secondary/10",
                  !isSelected && !matched && "border-border bg-card/60 hover:bg-muted/60",
                  correct && "border-emerald-400 bg-emerald-50 text-emerald-800",
                  wrong && "border-red-400 bg-red-50 text-red-800"
                )}
              >
                {pair.prompt}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Answers
          </p>
          {shuffledAnswers.map((pair) => {
            const pickedByPrompt = Object.entries(selections).find(
              ([, answerId]) => answerId === pair.id
            )?.[0];
            const taken = !!pickedByPrompt && !submitted;
            const correct = submitted && pickedByPrompt && isCorrect(pickedByPrompt);
            const wrong = submitted && pickedByPrompt && !isCorrect(pickedByPrompt);

            return (
              <button
                key={pair.id}
                type="button"
                disabled={submitted || (taken && !selectedPrompt)}
                onClick={() => handleAnswerClick(pair.id)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  selectedPrompt && !taken && "border-primary/50 hover:bg-primary/8 hover:border-primary",
                  taken && !submitted && "border-secondary/50 bg-secondary/10 opacity-60",
                  !selectedPrompt && !taken && !submitted && "border-border bg-card/60",
                  correct && "border-emerald-400 bg-emerald-50 text-emerald-800",
                  wrong && "border-red-400 bg-red-50 text-red-800",
                  !pickedByPrompt && submitted && "border-border bg-card/60 opacity-50"
                )}
              >
                {pair.answer}
              </button>
            );
          })}
        </div>
      </div>
    </ActivityShell>
  );
}
