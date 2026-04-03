"use client";

import * as React from "react";

import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type RubricResponseActivity = Extract<ActivityDefinition, { kind: "rubric_response" }>;

interface Props {
  activity: RubricResponseActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[]) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
}

function readInitialResponses(initialAnswers: AttemptAnswer[]) {
  const next: Record<string, number> = {};
  let note = "";

  for (const answer of initialAnswers) {
    if (answer.questionId === "note" && typeof answer.value === "string") {
      note = answer.value;
    } else if (typeof answer.value === "number") {
      next[answer.questionId] = answer.value;
    }
  }

  return { scores: next, note };
}

export function RubricResponseRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
}: Props) {
  const [state, setState] = React.useState(() => readInitialResponses(initialAnswers));

  React.useEffect(() => {
    setState(readInitialResponses(initialAnswers));
  }, [activity.criteria, initialAnswers]);

  function emit(nextState: typeof state) {
    const answers: AttemptAnswer[] = [
      ...activity.criteria.map((criterion) => ({
        questionId: criterion.id,
        value: nextState.scores[criterion.id] ?? activity.levels[0]?.value ?? 1,
      })),
    ];

    if (nextState.note.trim().length > 0) {
      answers.push({ questionId: "note", value: nextState.note.trim() });
    }

    onAnswerChange?.(answers);
    return answers;
  }

  function setScore(criterionId: string, value: number) {
    const next = {
      ...state,
      scores: { ...state.scores, [criterionId]: value },
    };
    setState(next);
    emit(next);
  }

  function setNote(note: string) {
    const next = { ...state, note };
    setState(next);
    emit(next);
  }

  return (
    <ActivityShell
      title={activity.title}
      instructions={activity.instructions ?? "Review each criterion and record the best fit."}
      estimatedMinutes={estimatedMinutes}
      onSubmit={onSubmit ? () => onSubmit(emit(state)) : undefined}
      submitting={submitting}
      submitted={submitted}
    >
      <div className="space-y-5">
        {activity.prompt ? (
          <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <p className="text-sm leading-7 text-foreground/90">{activity.prompt.text}</p>
          </div>
        ) : null}

        <div className="space-y-4">
          {activity.criteria.map((criterion) => (
            <fieldset key={criterion.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
              <legend className="px-1 text-sm font-medium text-foreground">{criterion.label}</legend>
              {criterion.description ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{criterion.description}</p>
              ) : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {activity.levels.map((level) => {
                  const inputId = `${criterion.id}-${level.value}`;
                  const selected = (state.scores[criterion.id] ?? activity.levels[0].value) === level.value;

                  return (
                    <label
                      key={inputId}
                      htmlFor={inputId}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm transition-colors ${
                        selected ? "border-primary bg-primary/8" : "border-border/70 bg-background/70 hover:bg-muted/40"
                      }`}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={criterion.id}
                        value={level.value}
                        checked={selected}
                        onChange={() => setScore(criterion.id, level.value)}
                        className="mt-1 size-4 text-primary focus:ring-ring"
                        disabled={submitted}
                      />
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{level.label}</p>
                        {level.description ? (
                          <p className="text-xs leading-5 text-muted-foreground">{level.description}</p>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">{activity.notePrompt ?? "Notes"}</span>
          <textarea
            value={state.note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            disabled={submitted}
            className="w-full rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            placeholder="Add evidence, context, or a short reflection."
          />
        </label>
      </div>
    </ActivityShell>
  );
}
