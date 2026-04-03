"use client";

import * as React from "react";

import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type FileSubmissionActivity = Extract<ActivityDefinition, { kind: "file_submission" }>;

interface Props {
  activity: FileSubmissionActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[]) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
}

type FileDescriptor = {
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

function readInitialState(initialAnswers: AttemptAnswer[]) {
  const filesAnswer = initialAnswers.find((answer) => answer.questionId === "files");
  const noteAnswer = initialAnswers.find((answer) => answer.questionId === "note");

  return {
    files:
      Array.isArray(filesAnswer?.value)
        ? (filesAnswer.value as FileDescriptor[])
        : [],
    note: typeof noteAnswer?.value === "string" ? noteAnswer.value : "",
  };
}

export function FileSubmissionRenderer({
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
  }, [activity.maxFiles, initialAnswers]);

  function emit(nextState: typeof state) {
    const answers: AttemptAnswer[] = [];
    if (nextState.files.length > 0) {
      answers.push({ questionId: "files", value: nextState.files });
    }
    if (nextState.note.trim().length > 0) {
      answers.push({ questionId: "note", value: nextState.note.trim() });
    }
    onAnswerChange?.(answers);
    return answers;
  }

  function handleFiles(fileList: FileList | null) {
    const files = fileList
      ? Array.from(fileList).map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
        }))
      : [];
    const next = { ...state, files };
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
      instructions={activity.instructions ?? "Attach the file or files that show your work."}
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

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Files</span>
          <input
            type="file"
            multiple={(activity.maxFiles ?? 1) > 1}
            accept={activity.accept?.join(",")}
            onChange={(event) => handleFiles(event.target.files)}
            disabled={submitted}
            className="block w-full cursor-pointer rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {state.files.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Selected files</p>
            <ul className="space-y-2">
              {state.files.map((file) => (
                <li key={`${file.name}-${file.lastModified}`} className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                  {file.name} · {file.type || "unknown type"} · {Math.max(1, Math.round(file.size / 1024))} KB
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">{activity.notePrompt ?? "Submission note"}</span>
          <textarea
            value={state.note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            disabled={submitted}
            className="w-full rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            placeholder="Add a short note about what you uploaded."
          />
        </label>
      </div>
    </ActivityShell>
  );
}
