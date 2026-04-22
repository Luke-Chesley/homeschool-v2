"use client";

/**
 * Activity session page — the main learner interaction surface.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { ActivityRenderer } from "@/components/activities/ActivityRenderer";
import { ActivityStudioPanel } from "@/components/activities/ActivityStudioPanel";
import { Button } from "@/components/ui/button";
import { ActivityComponentFeedbackSchema, type ActivityComponentFeedback } from "@/lib/activities/feedback";
import type {
  ActivityAssetComponentType,
  ActivityAssetKind,
  StoredActivityAttachment,
} from "@/lib/activities/uploads";
import type { ActivityAttempt, ActivitySession, ActivitySubmitResponse, AttemptAnswer } from "@/lib/activities/types";
import { WidgetTransitionArtifactSchema, type WidgetLearnerAction } from "@/lib/activities/widget-transition";
import type { InteractiveWidgetPayload } from "@/lib/activities/widgets";

interface Props {
  params: Promise<{ sessionId: string }>;
}

function getSessionKindLabel(session: ActivitySession) {
  const definition = session.definition as unknown as {
    kind?: string;
    activityKind?: string;
  };

  return definition.kind ?? definition.activityKind ?? "activity";
}

export default function ActivitySessionPage({ params }: Props) {
  const [sessionId, setSessionId] = React.useState<string>("");
  const [session, setSession] = React.useState<ActivitySession | null>(null);
  const [attempt, setAttempt] = React.useState<ActivityAttempt | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = React.useState<{
    componentId: string;
    componentType: string;
    learnerResponse: unknown;
    result: ActivityComponentFeedback | null;
  } | null>(null);
  const [lastTransition, setLastTransition] = React.useState<{
    componentId: string;
    componentType: string;
    learnerAction: WidgetLearnerAction;
    currentResponse: unknown;
    result: unknown;
  } | null>(null);

  React.useEffect(() => {
    params.then((p) => setSessionId(p.sessionId));
  }, [params]);

  React.useEffect(() => {
    if (!sessionId) return;

    async function load() {
      try {
        const sessionRes = await fetch(`/api/activities/sessions/${sessionId}`);
        if (!sessionRes.ok) throw new Error("Session not found");
        const sessionData: ActivitySession = await sessionRes.json();
        setSession(sessionData);

        const attemptRes = await fetch("/api/activities/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!attemptRes.ok) throw new Error("Could not start attempt");
        const attemptData: ActivityAttempt = await attemptRes.json();
        setAttempt(attemptData);

        if (attemptData.status === "submitted" || attemptData.status === "graded") {
          setSubmitted(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load activity");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [sessionId]);

  async function handleAnswerChange(answers: AttemptAnswer[], uiState?: Record<string, unknown>) {
    if (!attempt) return;
    try {
      const res = await fetch(`/api/activities/attempts/${attempt.id}/autosave`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, uiState }),
      });
      if (res.ok) {
        const updated: ActivityAttempt = await res.json();
        setAttempt(updated);
      }
    } catch {
      // Autosave failures are non-fatal.
    }
  }

  async function handleSubmit(answers: AttemptAnswer[]) {
    if (!attempt) return;
    setSubmitting(true);
    try {
      await handleAnswerChange(answers);
      const res = await fetch(`/api/activities/attempts/${attempt.id}/submit`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Submit failed");
      const payload: ActivitySubmitResponse = await res.json();
      setAttempt(payload.attempt);
      setSubmitted(payload.attempt.status === "submitted" || payload.attempt.status === "graded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComponentAssetUpload(
    componentId: string,
    componentType: ActivityAssetComponentType,
    kind: ActivityAssetKind,
    file: File,
  ): Promise<StoredActivityAttachment> {
    if (!attempt) {
      throw new Error("Activity attempt not ready.");
    }

    const formData = new FormData();
    formData.set("componentId", componentId);
    formData.set("componentType", componentType);
    formData.set("kind", kind);
    formData.set("file", file);

    const response = await fetch(`/api/activities/attempts/${attempt.id}/assets`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(
        payload && typeof payload.error === "string"
          ? payload.error
          : "Upload failed.",
      );
    }

    return response.json();
  }

  async function handleComponentAssetDelete(
    componentId: string,
    componentType: ActivityAssetComponentType,
    kind: ActivityAssetKind,
    asset: StoredActivityAttachment,
  ): Promise<void> {
    if (!attempt) {
      throw new Error("Activity attempt not ready.");
    }

    const response = await fetch(`/api/activities/attempts/${attempt.id}/assets`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        componentId,
        componentType,
        kind,
        asset,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(
        payload && typeof payload.error === "string"
          ? payload.error
          : "Could not remove the uploaded file.",
      );
    }
  }

  async function handleComponentFeedback(
    componentId: string,
    componentType: string,
    learnerResponse: unknown,
  ): Promise<ActivityComponentFeedback | null> {
    if (!attempt) {
      return null;
    }

    const response = await fetch(`/api/activities/attempts/${attempt.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        componentId,
        componentType,
        learnerResponse,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const result = ActivityComponentFeedbackSchema.parse(payload);
    setLastFeedback({
      componentId,
      componentType,
      learnerResponse,
      result,
    });
    return result;
  }

  async function handleComponentTransition(
    componentId: string,
    componentType: string,
    widget: InteractiveWidgetPayload,
    learnerAction: WidgetLearnerAction,
    currentResponse: unknown,
  ) {
    if (!attempt) {
      return null;
    }

    const response = await fetch(`/api/activities/attempts/${attempt.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        componentId,
        componentType,
        widget,
        learnerAction,
        currentResponse,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const result = WidgetTransitionArtifactSchema.parse(payload);
    setLastTransition({
      componentId,
      componentType,
      learnerAction,
      currentResponse,
      result,
    });
    return result;
  }

  if (loading) {
    return (
      <div className="learner-reading-surface">
        <div className="learner-reading-column space-y-4 py-2">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded-full bg-muted/80" />
            <div className="h-9 w-3/4 rounded-2xl bg-muted/80" />
            <div className="h-4 w-full rounded-full bg-muted/70" />
            <div className="h-4 w-2/3 rounded-full bg-muted/70" />
          </div>
          <div className="rounded-xl border border-border/70 bg-background/80 p-4">
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Loading activity…</p>
                <p className="text-sm text-muted-foreground">
                  Restoring the learner session and any saved progress from this activity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="learner-reading-surface">
        <div className="learner-reading-column flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-sm text-destructive">{error ?? "Activity not found."}</p>
          <Link href="/learner">
            <Button variant="outline" size="sm">Back to queue</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3 border-b border-border/70 pb-4">
        <Link href="/learner" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to queue
        </Link>
        <p className="section-meta">
          {getSessionKindLabel(session).replaceAll("_", " ")}
          {session.estimatedMinutes ? ` · ${session.estimatedMinutes} min` : ""}
        </p>
      </div>

      <div className="space-y-6">
        <ActivityRenderer
          definition={session.definition}
          attempt={attempt}
          estimatedMinutes={session.estimatedMinutes}
              onAnswerChange={handleAnswerChange}
              onComponentFeedbackRequest={handleComponentFeedback}
              onComponentTransitionRequest={handleComponentTransition}
              onComponentAssetUploadRequest={handleComponentAssetUpload}
              onComponentAssetDeleteRequest={handleComponentAssetDelete}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitted={submitted}
        />

        <ActivityStudioPanel
          session={session}
          attempt={attempt}
          submitted={submitted}
          error={error}
          lastFeedback={lastFeedback}
          lastTransition={lastTransition}
        />

        {submitted ? (
          <div className="learner-reading-surface">
            <div className="learner-reading-column flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                This session is finished and saved to today’s work.
              </p>
              <Link href="/learner">
                <Button variant="outline" size="sm">Back to queue</Button>
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
