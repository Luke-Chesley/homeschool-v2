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
import type {
  ActivityAssetComponentType,
  ActivityAssetKind,
  StoredActivityAttachment,
} from "@/lib/activities/uploads";
import type { ActivitySpec } from "@/lib/activities/spec";
import type { InteractiveWidgetComponent, InteractiveWidgetPayload } from "@/lib/activities/widgets";
import { readBoardMove, type WidgetLearnerAction, type WidgetTransitionArtifact } from "@/lib/activities/widget-transition";
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
  /** Persisted feedback from a submitted attempt */
  initialFeedbackByComponent?: Record<string, ActivityComponentFeedback>;
  estimatedMinutes?: number;
  onEvidenceChange?: (evidence: ActivitySpecEvidence) => void;
  onComponentFeedbackRequest?: (
    componentId: string,
    componentType: ComponentSpec["type"],
    value: unknown,
  ) => Promise<ActivityComponentFeedback | null>;
  onComponentTransitionRequest?: (
    componentId: string,
    componentType: ComponentSpec["type"],
    widget: InteractiveWidgetPayload,
    learnerAction: WidgetLearnerAction,
    currentValue: unknown,
  ) => Promise<WidgetTransitionArtifact | null>;
  onComponentAssetUploadRequest?: (
    componentId: string,
    componentType: ActivityAssetComponentType,
    kind: ActivityAssetKind,
    file: File,
  ) => Promise<StoredActivityAttachment>;
  onComponentAssetDeleteRequest?: (
    componentId: string,
    componentType: ActivityAssetComponentType,
    kind: ActivityAssetKind,
    asset: StoredActivityAttachment,
  ) => Promise<void>;
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
  initialFeedbackByComponent,
  estimatedMinutes,
  onEvidenceChange,
  onComponentFeedbackRequest,
  onComponentTransitionRequest,
  onComponentAssetUploadRequest,
  onComponentAssetDeleteRequest,
  onSubmit,
  submitting,
  submitted,
}: ActivitySpecRendererProps) {
  const [evidence, setEvidence] = React.useState<ActivitySpecEvidence>(initialEvidence);
  const [feedbackByComponent, setFeedbackByComponent] = React.useState<Record<string, ActivityComponentFeedback>>(
    () => initialFeedbackByComponent ?? {},
  );
  const [widgetByComponent, setWidgetByComponent] = React.useState<Record<string, InteractiveWidgetPayload>>(
    () => buildInitialWidgetState(spec, initialEvidence),
  );
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  React.useEffect(() => {
    setEvidence(initialEvidence);
    setFeedbackByComponent(initialFeedbackByComponent ?? {});
    setWidgetByComponent(buildInitialWidgetState(spec, initialEvidence));
    setSubmitAttempted(false);
  }, [spec]);

  React.useEffect(() => {
    if (!initialFeedbackByComponent) {
      return;
    }

    setFeedbackByComponent(initialFeedbackByComponent);
  }, [initialFeedbackByComponent]);

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

  async function handleComponentTransition(
    componentId: string,
    componentType: ComponentSpec["type"],
    widget: InteractiveWidgetPayload,
    learnerAction: WidgetLearnerAction,
    currentValue: unknown,
  ) {
    if (!onComponentTransitionRequest) {
      return null;
    }

    const transition = await onComponentTransitionRequest(
      componentId,
      componentType,
      widget,
      learnerAction,
      currentValue,
    );
    if (transition?.canonicalWidget) {
      setWidgetByComponent((current) => ({
        ...current,
        [componentId]: transition.canonicalWidget,
      }));
    }
    const immediateFeedback = transition?.immediateFeedback;
    if (immediateFeedback) {
      setFeedbackByComponent((current) => ({
        ...current,
        [componentId]: immediateFeedback,
      }));
    }
    return transition;
  }

  const interactiveComponents = spec.components.filter((c) => isInteractiveComponentSpec(c));
  const requiredInteractiveComponents = interactiveComponents.filter((component) => isRequiredComponent(component));
  const answeredCount = interactiveComponents.filter((component) => isComponentAnswered(component, evidence[component.id])).length;
  const incompleteRequiredComponents = requiredInteractiveComponents.filter(
    (component) => !isComponentAnswered(component, evidence[component.id]),
  );

  const progress = interactiveComponents.length > 0
    ? answeredCount / interactiveComponents.length
    : 1;

  // Completion check
  function canSubmit(): boolean {
    if (submitted || submitting) return false;
    const rules = spec.completionRules;

    switch (rules.strategy) {
      case "all_interactive_components":
        return incompleteRequiredComponents.length === 0;
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
  const nextMissingComponent = incompleteRequiredComponents[0] ?? null;
  const incompleteMessage =
    spec.completionRules.incompleteMessage ??
    (incompleteRequiredComponents.length === 1
      ? "One required step is still missing before you can submit."
      : `${incompleteRequiredComponents.length} required steps are still missing before you can submit.`);

  function focusMissingComponent(componentId: string) {
    const element = document.getElementById(`activity-component-${componentId}`);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusTarget = element.querySelector<HTMLElement>("input, textarea, button, [tabindex]");
    focusTarget?.focus();
  }

  function handleSubmitAttempt() {
    if (submitting || submitted || !onSubmit) {
      return;
    }

    if (!canSubmit()) {
      setSubmitAttempted(true);
      if (nextMissingComponent) {
        focusMissingComponent(nextMissingComponent.id);
      }
      return;
    }

    onSubmit(evidence);
  }

  return (
    <div className="learner-reading-surface">
      <div className="learner-reading-column flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="learner-toolbar text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                {ACTIVITY_KIND_LABELS[spec.activityKind] ?? spec.activityKind}
              </span>
              {spec.interactionMode !== "digital" ? (
                <span className="rounded-full border border-border/80 px-2.5 py-1 capitalize">
                  {spec.interactionMode}
                </span>
              ) : null}
            </div>
            <h2 className="font-serif text-[2rem] leading-tight tracking-tight text-foreground">{spec.title}</h2>
            {spec.purpose ? <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{spec.purpose}</p> : null}
          </div>
          {displayMinutes ? (
            <div className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-border/80 px-2.5 py-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {displayMinutes} min
            </div>
          ) : null}
        </div>

        {interactiveComponents.length > 0 && !submitted ? (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {answeredCount}/{interactiveComponents.length}
            </span>
          </div>
        ) : null}

        {spec.interactionMode !== "digital" && spec.offlineMode ? (
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
        ) : null}

        <div className="flex flex-col gap-5">
          {spec.components.map((component) => (
            <div
              key={component.id}
              id={`activity-component-${component.id}`}
              className={cn(
                "scroll-mt-24 rounded-xl transition-colors",
                submitAttempted && incompleteRequiredComponents.some((item) => item.id === component.id)
                  ? "border border-amber-300/80 bg-amber-50/60 p-3"
                  : undefined,
              )}
            >
              {(() => {
                const resolvedComponent = resolveComponent(component, widgetByComponent[component.id]);
                return (
                  <>
                    {renderComponent({
                      spec: resolvedComponent,
                      value: evidence[component.id],
                      onChange: handleComponentChange,
                      feedback: feedbackByComponent[component.id] ?? null,
                      onRequestFeedback: handleComponentFeedback,
                      onRequestTransition: handleComponentTransition,
                      onRequestAssetUpload: onComponentAssetUploadRequest,
                      onRequestAssetDelete: onComponentAssetDeleteRequest,
                      disabled: submitted,
                      hintStrategy,
                    })}
                    {feedbackByComponent[component.id] && shouldRenderFeedbackBanner(resolvedComponent) ? (
                      <ComponentFeedbackBanner feedback={feedbackByComponent[component.id]} />
                    ) : null}
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {spec.teacherSupport && !submitted ? (
          <TeacherSupportPanel support={spec.teacherSupport} />
        ) : null}

        {submitted ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/7 px-4 py-3 text-sm text-foreground">
            <CheckCircle className="size-4 shrink-0 text-primary" />
            Activity submitted. Feedback is shown below.
          </div>
        ) : null}

        {!canSubmit() && !submitted ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-2">
                <p>{incompleteMessage}</p>
                {incompleteRequiredComponents.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-800/80">
                      Still needed
                    </p>
                    <ul className="space-y-1 text-sm">
                      {incompleteRequiredComponents.slice(0, 3).map((component) => (
                        <li key={component.id}>
                          {getComponentLabel(component)}
                        </li>
                      ))}
                      {incompleteRequiredComponents.length > 3 ? (
                        <li className="text-xs text-amber-800/80">
                          {incompleteRequiredComponents.length - 3} more step(s)
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                {nextMissingComponent ? (
                  <button
                    type="button"
                    onClick={() => focusMissingComponent(nextMissingComponent.id)}
                    className="inline-flex min-h-11 items-center rounded-md border border-amber-300 bg-white/70 px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-white sm:min-h-8 sm:px-2.5 sm:py-1.5 sm:text-xs"
                  >
                    Go to the next missing step
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!submitted && onSubmit ? (
          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {spec.adaptationRules?.allowSkip ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => onSubmit(evidence)}
                className="min-h-11 w-full justify-center sm:min-h-8 sm:w-auto"
              >
                Skip
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={submitting}
              onClick={handleSubmitAttempt}
              className="min-h-11 w-full justify-center sm:min-h-8 sm:w-auto"
            >
              {submitting ? "Submitting…" : canSubmit() ? "Submit and view feedback" : "Review missing steps"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildInitialWidgetState(
  spec: ActivitySpec,
  initialEvidence: ActivitySpecEvidence,
): Record<string, InteractiveWidgetPayload> {
  const state: Record<string, InteractiveWidgetPayload> = {};

  for (const component of spec.components) {
    if (component.type !== "interactive_widget") {
      continue;
    }

    state[component.id] = restoreWidgetFromEvidence(component, initialEvidence[component.id]);
  }

  return state;
}

function restoreWidgetFromEvidence(
  component: InteractiveWidgetComponent,
  evidence: unknown,
): InteractiveWidgetPayload {
  if (component.widget.engineKind !== "chess") {
    return component.widget;
  }

  const restoredMove = readBoardMove(evidence);
  if (!restoredMove?.fenAfter) {
    return component.widget;
  }

  return {
    ...component.widget,
    state: {
      ...component.widget.state,
      fen: restoredMove.fenAfter,
    },
  };
}

function resolveComponent(
  component: ComponentSpec,
  widget: InteractiveWidgetPayload | undefined,
): ComponentSpec {
  if (component.type !== "interactive_widget" || !widget) {
    return component;
  }

  return {
    ...component,
    widget,
  };
}

function shouldRenderFeedbackBanner(component: ComponentSpec) {
  if (component.type !== "interactive_widget") {
    return true;
  }

  return component.widget.feedback.displayMode !== "inline";
}

function isRequiredComponent(component: ComponentSpec) {
  return "required" in component ? component.required !== false : true;
}

function isComponentAnswered(component: ComponentSpec, value: unknown): boolean {
  if (component.type === "checklist") {
    if (!Array.isArray(value)) {
      return false;
    }

    if (component.allowPartialSubmit) {
      return value.length > 0;
    }

    const requiredIds = component.items.filter((item) => item.required !== false).map((item) => item.id);
    return requiredIds.every((itemId) => value.includes(itemId));
  }

  if (component.type === "audio_capture") {
    return value === true || (typeof value === "object" && value !== null && "recorded" in value);
  }

  if (component.type === "observation_record" || component.type === "teacher_checkoff") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }

    return Object.keys(value).length > 0;
  }

  if (value == null || value === "") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return true;
}

function getComponentLabel(component: ComponentSpec) {
  if ("prompt" in component && typeof component.prompt === "string" && component.prompt.trim()) {
    return component.prompt.trim();
  }

  if (component.type === "checklist") {
    return component.prompt?.trim() || "Checklist";
  }

  if (component.type === "interactive_widget") {
    return "Interactive step";
  }

  if (component.type === "reflection_prompt") {
    return component.prompt.trim();
  }

  return component.type.replaceAll("_", " ");
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
