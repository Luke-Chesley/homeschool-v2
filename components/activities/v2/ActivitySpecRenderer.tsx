"use client";

/**
 * ActivitySpecRenderer — the top-level renderer for v2 ActivitySpec objects.
 *
 * Renders an ordered list of components from the activity spec using the
 * component registry. Manages accumulated evidence state and progress.
 *
 * This replaces the old per-kind renderer dispatch in ActivityRenderer.tsx
 * for activities with schemaVersion "2".
 */

import * as React from "react";
import { Clock, CheckCircle, BookOpen, MapPin, AlertCircle, CircleCheck, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderComponent } from "./ComponentRegistry";
import { isInteractiveComponentSpec, type ComponentSpec } from "@/lib/activities/components";
import type { ActivityComponentFeedback } from "@/lib/activities/feedback";
import type { ActivitySpec } from "@/lib/activities/spec";
import { ACTIVITY_KIND_LABELS } from "@/lib/activities/kinds";

// ---------------------------------------------------------------------------
// Evidence shape passed up to parent
// ---------------------------------------------------------------------------

export type ActivitySpecEvidence = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActivitySpecRendererProps {
  spec: ActivitySpec;
  /** Pre-loaded evidence from a resumed attempt */
  initialEvidence?: ActivitySpecEvidence;
  estimatedMinutes?: number;
  onEvidenceChange?: (evidence: ActivitySpecEvidence) => void;
  onComponentFeedbackRequest?: (
    componentId: string,
    componentType: ComponentSpec["type"],
    value: unknown,
  ) => Promise<ActivityComponentFeedback | null>;
  onSubmit?: (evidence: ActivitySpecEvidence) => void;
  submitting?: boolean;
  submitted?: boolean;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function ActivitySpecRenderer({
  spec,
  initialEvidence = {},
  estimatedMinutes,
  onEvidenceChange,
  onComponentFeedbackRequest,
  onSubmit,
  submitting,
  submitted,
}: ActivitySpecRendererProps) {
  const [evidence, setEvidence] = React.useState<ActivitySpecEvidence>(initialEvidence);
  const [feedbackByComponent, setFeedbackByComponent] = React.useState<Record<string, ActivityComponentFeedback>>({});

  function handleComponentChange(componentId: string, value: unknown) {
    const next = { ...evidence, [componentId]: value };
    setEvidence(next);
    setFeedbackByComponent((current) => {
      if (!(componentId in current)) {
        return current;
      }
      const { [componentId]: _removed, ...rest } = current;
      return rest;
    });
    onEvidenceChange?.(next);
  }

  async function handleComponentFeedback(
    componentId: string,
    componentType: ComponentSpec["type"],
    value: unknown,
  ) {
    if (!onComponentFeedbackRequest) {
      return null;
    }

    const feedback = await onComponentFeedbackRequest(componentId, componentType, value);
    if (feedback) {
      setFeedbackByComponent((current) => ({
        ...current,
        [componentId]: feedback,
      }));
    }
    return feedback;
  }

  // Calculate completion progress
  const interactiveComponents = spec.components.filter((c) => isInteractiveComponentSpec(c));
  const answeredCount = interactiveComponents.filter((c) => {
    const v = evidence[c.id];
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return false;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
    return true;
  }).length;

  const progress = interactiveComponents.length > 0
    ? answeredCount / interactiveComponents.length
    : 1;

  // Completion check
  function canSubmit(): boolean {
    if (submitted || submitting) return false;
    const rules = spec.completionRules;

    switch (rules.strategy) {
      case "all_interactive_components":
        return answeredCount >= interactiveComponents.length;
      case "minimum_components":
        return answeredCount >= (rules.minimumComponents ?? 1);
      case "any_submission":
        return true;
      case "teacher_approval":
        return true; // Teacher submits on behalf
      default:
        return true;
    }
  }

  const hintStrategy = spec.adaptationRules?.hintStrategy ?? "on_request";
  const displayMinutes = estimatedMinutes ?? spec.estimatedMinutes;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5">
              {ACTIVITY_KIND_LABELS[spec.activityKind] ?? spec.activityKind}
            </span>
            {spec.interactionMode !== "digital" && (
              <span className="rounded-full border border-border text-muted-foreground text-xs px-2 py-0.5 capitalize">
                {spec.interactionMode}
              </span>
            )}
          </div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">{spec.title}</h2>
          {spec.purpose && (
            <p className="mt-1 text-sm text-muted-foreground">{spec.purpose}</p>
          )}
        </div>
        {displayMinutes && (
          <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            ~{displayMinutes} min
          </div>
        )}
      </div>

      {/* Progress bar */}
      {interactiveComponents.length > 0 && !submitted && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {answeredCount}/{interactiveComponents.length}
          </span>
        </div>
      )}

      {/* Offline mode info */}
      {spec.interactionMode !== "digital" && spec.offlineMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <MapPin className="size-4 text-amber-700" />
            <p className="text-sm font-semibold text-amber-800">Offline activity</p>
          </div>
          <p className="text-sm text-amber-800">{spec.offlineMode.offlineTaskDescription}</p>
          {spec.offlineMode.materials && spec.offlineMode.materials.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {spec.offlineMode.materials.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
          {spec.offlineMode.evidenceCaptureInstruction && (
            <p className="mt-2 text-xs text-amber-700">
              {spec.offlineMode.evidenceCaptureInstruction}
            </p>
          )}
        </div>
      )}

      {/* Components */}
      <div className="flex flex-col gap-5">
        {spec.components.map((component) => (
          <div key={component.id}>
            {renderComponent({
              spec: component,
              value: evidence[component.id],
              onChange: handleComponentChange,
              feedback: feedbackByComponent[component.id] ?? null,
              onRequestFeedback: handleComponentFeedback,
              disabled: submitted,
              hintStrategy,
            })}
            {feedbackByComponent[component.id] && (
              <ComponentFeedbackBanner feedback={feedbackByComponent[component.id]} />
            )}
          </div>
        ))}
      </div>

      {/* Teacher support (shown collapsed) */}
      {spec.teacherSupport && !submitted && (
        <TeacherSupportPanel support={spec.teacherSupport} />
      )}

      {/* Submitted state */}
      {submitted && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-4 text-sm text-primary">
          <CheckCircle className="size-4 shrink-0" />
          Activity submitted.
        </div>
      )}

      {/* Incomplete message */}
      {!canSubmit() && !submitted && answeredCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {spec.completionRules.incompleteMessage ?? "Answer all questions to submit."}
        </p>
      )}

      {/* Submit action */}
      {!submitted && onSubmit && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {spec.adaptationRules?.allowSkip && (
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => onSubmit(evidence)}
            >
              Skip
            </Button>
          )}
          <Button
            size="sm"
            disabled={!canSubmit() || submitting}
            onClick={() => onSubmit(evidence)}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teacher support panel (collapsible)
// ---------------------------------------------------------------------------

function TeacherSupportPanel({ support }: { support: NonNullable<ActivitySpec["teacherSupport"]> }) {
  const [open, setOpen] = React.useState(false);

  const hasContent =
    support.setupNotes ||
    (support.discussionQuestions?.length ?? 0) > 0 ||
    (support.masteryIndicators?.length ?? 0) > 0 ||
    support.commonMistakes ||
    support.extensionIdeas;

  if (!hasContent) return null;

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/30"
      >
        <BookOpen className="size-4" />
        Teacher support
        <span className="ml-auto text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-3 flex flex-col gap-3 bg-muted/20 text-sm">
          {support.setupNotes && (
            <div>
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Setup
              </p>
              <p>{support.setupNotes}</p>
            </div>
          )}
          {support.masteryIndicators && support.masteryIndicators.length > 0 && (
            <div>
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Mastery indicators
              </p>
              <ul className="space-y-0.5">
                {support.masteryIndicators.map((m, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {support.discussionQuestions && support.discussionQuestions.length > 0 && (
            <div>
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Discussion questions
              </p>
              <ul className="space-y-0.5">
                {support.discussionQuestions.map((q, i) => (
                  <li key={i} className={cn("flex items-start gap-1.5")}>
                    <span className="text-muted-foreground mt-0.5">{i + 1}.</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {support.commonMistakes && (
            <div>
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Common mistakes
              </p>
              <p>{support.commonMistakes}</p>
            </div>
          )}
          {support.extensionIdeas && (
            <div>
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Extension ideas
              </p>
              <p>{support.extensionIdeas}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComponentFeedbackBanner({ feedback }: { feedback: ActivityComponentFeedback }) {
  const icon = feedback.status === "correct"
    ? <CircleCheck className="mt-0.5 size-4 shrink-0" />
    : feedback.status === "partial"
      ? <CircleDashed className="mt-0.5 size-4 shrink-0" />
      : <AlertCircle className="mt-0.5 size-4 shrink-0" />;

  const tone = feedback.status === "correct"
    ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
    : feedback.status === "partial"
      ? "border-amber-200 bg-amber-50/80 text-amber-900"
      : "border-border bg-muted/50 text-foreground";

  return (
    <div className={cn("mt-3 rounded-xl border px-3 py-2.5 text-sm", tone)}>
      <div className="flex items-start gap-2">
        {icon}
        <div className="space-y-1">
          <p>{feedback.feedbackMessage}</p>
          {feedback.hint && (
            <p className="text-xs opacity-85">Hint: {feedback.hint}</p>
          )}
          {feedback.nextStep && (
            <p className="text-xs opacity-85">Next step: {feedback.nextStep}</p>
          )}
        </div>
      </div>
    </div>
  );
}
