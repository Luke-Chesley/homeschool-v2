"use client";

/**
 * ActivityRenderer — top-level dispatcher.
 *
 * Routes to the correct renderer based on activity.kind. This is the single
 * integration point for new activity types — add a new case here and a
 * corresponding renderer component.
 *
 * No arbitrary code execution: activity definitions are pure data schemas.
 */

import * as React from "react";
import type {
  ActivityDefinition,
  AttemptAnswer,
  ActivityAttempt,
  HybridLayoutActivity,
  HybridComponent,
} from "@/lib/activities/types";
import { QuizRenderer } from "./QuizRenderer";
import { FlashcardsRenderer } from "./FlashcardsRenderer";
import { MatchingRenderer } from "./MatchingRenderer";
import { SequencingRenderer } from "./SequencingRenderer";
import { GuidedPracticeRenderer } from "./GuidedPracticeRenderer";
import { ReflectionRenderer } from "./ReflectionRenderer";

export interface ActivityRendererProps {
  definition: ActivityDefinition;
  attempt?: ActivityAttempt | null;
  estimatedMinutes?: number;
  onAnswerChange?: (answers: AttemptAnswer[], uiState?: Record<string, unknown>) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
}

export function ActivityRenderer({
  definition,
  attempt,
  estimatedMinutes,
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
}: ActivityRendererProps) {
  const initialAnswers = attempt?.answers ?? [];
  const initialUiState = attempt?.uiState;

  switch (definition.kind) {
    case "quiz":
      return (
        <QuizRenderer
          activity={definition}
          initialAnswers={initialAnswers}
          estimatedMinutes={estimatedMinutes}
          onAnswerChange={onAnswerChange}
          onSubmit={onSubmit}
          submitting={submitting}
          submitted={submitted}
        />
      );

    case "flashcards":
      return (
        <FlashcardsRenderer
          activity={definition}
          initialAnswers={initialAnswers}
          initialUiState={initialUiState}
          estimatedMinutes={estimatedMinutes}
          onAnswerChange={(answers, uiState) => onAnswerChange?.(answers, uiState)}
          onSubmit={onSubmit}
          submitting={submitting}
          submitted={submitted}
        />
      );

    case "matching":
      return (
        <MatchingRenderer
          activity={definition}
          initialAnswers={initialAnswers}
          estimatedMinutes={estimatedMinutes}
          onAnswerChange={onAnswerChange}
          onSubmit={onSubmit}
          submitting={submitting}
          submitted={submitted}
        />
      );

    case "sequencing":
      return (
        <SequencingRenderer
          activity={definition}
          initialAnswers={initialAnswers}
          estimatedMinutes={estimatedMinutes}
          onAnswerChange={onAnswerChange}
          onSubmit={onSubmit}
          submitting={submitting}
          submitted={submitted}
        />
      );

    case "guided_practice":
      return (
        <GuidedPracticeRenderer
          activity={definition}
          initialAnswers={initialAnswers}
          initialUiState={initialUiState}
          estimatedMinutes={estimatedMinutes}
          onAnswerChange={(answers, uiState) => onAnswerChange?.(answers, uiState)}
          onSubmit={onSubmit}
          submitting={submitting}
          submitted={submitted}
        />
      );

    case "reflection":
      return (
        <ReflectionRenderer
          activity={definition}
          initialAnswers={initialAnswers}
          estimatedMinutes={estimatedMinutes}
          onAnswerChange={onAnswerChange}
          onSubmit={onSubmit}
          submitting={submitting}
          submitted={submitted}
        />
      );

    case "hybrid_layout":
      return (
        <HybridLayoutRenderer
          activity={definition}
          attempt={attempt}
          estimatedMinutes={estimatedMinutes}
          onAnswerChange={onAnswerChange}
          onSubmit={onSubmit}
          submitting={submitting}
          submitted={submitted}
        />
      );

    default:
      console.warn("Unknown activity kind:", (definition as { kind: string }).kind);
      return (
        <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
          Unknown activity type.
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Hybrid layout renderer
// ---------------------------------------------------------------------------

function HybridLayoutRenderer({
  activity,
  attempt,
  estimatedMinutes,
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
}: {
  activity: HybridLayoutActivity;
  attempt?: ActivityAttempt | null;
  estimatedMinutes?: number;
  onAnswerChange?: (answers: AttemptAnswer[], uiState?: Record<string, unknown>) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {activity.components.map((component: HybridComponent, idx: number) => {
        switch (component.type) {
          case "heading":
            return React.createElement(
              `h${component.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
              {
                key: idx,
                className: "font-serif font-semibold tracking-tight text-foreground",
              },
              component.text
            );

          case "paragraph":
            return (
              <p key={idx} className="text-sm leading-7 text-foreground/90">
                {component.content.text}
              </p>
            );

          case "image":
            return (
              <figure key={idx} className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={component.src}
                  alt={component.alt}
                  className="rounded-xl border border-border/50 w-full object-cover"
                />
                {component.caption && (
                  <figcaption className="text-xs text-center text-muted-foreground">
                    {component.caption}
                  </figcaption>
                )}
              </figure>
            );

          case "callout":
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 text-sm ${
                  component.variant === "warning"
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : component.variant === "tip"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-primary/30 bg-primary/5 text-primary/90"
                }`}
              >
                {component.content.text}
              </div>
            );

          case "divider":
            return <hr key={idx} className="border-border/50" />;

          case "quiz_embed":
          case "flashcard_embed":
          case "reflection_embed": {
            const embeddedDef = activity.embeds?.[component.activityId];
            if (!embeddedDef) {
              return (
                <div key={idx} className="rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">
                  Embedded activity ({component.activityId}) not found.
                </div>
              );
            }
            return (
              <div key={idx} className="rounded-xl border border-border/70 bg-card/60 p-5">
                <ActivityRenderer
                  definition={embeddedDef}
                  attempt={attempt}
                  estimatedMinutes={estimatedMinutes}
                  onAnswerChange={onAnswerChange}
                  onSubmit={onSubmit}
                  submitting={submitting}
                  submitted={submitted}
                />
              </div>
            );
          }

          case "video_embed":
            return (
              <div key={idx} className="rounded-xl overflow-hidden border border-border/50">
                <video
                  src={component.src}
                  controls
                  className="w-full"
                  aria-label={component.caption ?? "Video"}
                />
                {component.caption && (
                  <p className="px-4 py-2 text-xs text-muted-foreground">{component.caption}</p>
                )}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
