"use client";

import * as React from "react";

import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type SupervisorSignOffActivity = Extract<ActivityDefinition, { kind: "supervisor_sign_off" }>;

interface Props {
  activity: SupervisorSignOffActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[]) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
}

function readInitialState(initialAnswers: AttemptAnswer[]) {
  const noteAnswer = initialAnswers.find((answer) => answer.questionId === "note");
  const acknowledgedAnswer = initialAnswers.find((answer) => answer.questionId === "acknowledged");
  const checkedItems = new Set(
    initialAnswers
      .filter((answer) => answer.questionId !== "note" && answer.value === true)
      .map((answer) => answer.questionId),
  );

  return {
    acknowledged: Boolean(acknowledgedAnswer?.value),
    note: typeof noteAnswer?.value === "string" ? noteAnswer.value : "",
    checkedItems,
  };
}

export function SupervisorSignOffRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
}: Props) {
  const [state, setState] = React.useState(() => readInitialState(initialAnswers));

  React.useEffect(() => {
    setState(readInitialState(initialAnswers));
  }, [activity.items, initialAnswers]);

  function emit(nextState: typeof state) {
    const answers: AttemptAnswer[] = [
      { questionId: "acknowledged", value: nextState.acknowledged },
    ];

    for (const item of activity.items ?? []) {
      answers.push({
        questionId: item.id,
        value: nextState.checkedItems.has(item.id),
      });
    }

    if (nextState.note.trim().length > 0) {
      answers.push({ questionId: "note", value: nextState.note.trim() });
    }

    onAnswerChange?.(answers);
    return answers;
  }

  function toggleItem(itemId: string) {
    const nextChecked = new Set(state.checkedItems);
    if (nextChecked.has(itemId)) {
      nextChecked.delete(itemId);
    } else {
      nextChecked.add(itemId);
    }

    const next = { ...state, checkedItems: nextChecked };
    setState(next);
    emit(next);
  }

  function setAcknowledged(acknowledged: boolean) {
    const next = { ...state, acknowledged };
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
      instructions={activity.instructions ?? "Prepare the work for an adult to review and sign off."}
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

        {activity.items?.length ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">Review items</legend>
            {activity.items.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 text-sm transition-colors hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={state.checkedItems.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="mt-1 size-4 rounded border-border text-primary focus:ring-ring"
                  disabled={submitted}
                />
                <div className="min-w-0 space-y-1">
                  <span className="font-medium text-foreground">{item.label}</span>
                  {item.description ? (
                    <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>
              </label>
            ))}
          </fieldset>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 text-sm">
          <input
            type="checkbox"
            checked={state.acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1 size-4 rounded border-border text-primary focus:ring-ring"
            disabled={submitted}
          />
          <span className="min-w-0 text-foreground">
            {activity.acknowledgmentLabel ?? "I have finished this work and am ready for supervisor sign-off."}
          </span>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">{activity.notePrompt ?? "Notes for the supervisor"}</span>
          <textarea
            value={state.note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            disabled={submitted}
            className="w-full rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            placeholder="Add anything an adult should check or know."
          />
        </label>
      </div>
    </ActivityShell>
  );
}
