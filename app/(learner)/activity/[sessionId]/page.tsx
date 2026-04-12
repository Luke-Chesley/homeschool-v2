"use client";

/**
 * Activity session page — the main learner interaction surface.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ActivityRenderer } from "@/components/activities/ActivityRenderer";
import { ActivityStudioPanel } from "@/components/activities/ActivityStudioPanel";
import { Button } from "@/components/ui/button";
import { ActivityComponentFeedbackSchema, type ActivityComponentFeedback } from "@/lib/activities/feedback";
import type { ActivityAttempt, ActivitySession, AttemptAnswer } from "@/lib/activities/types";
import { WidgetTransitionArtifactSchema, type WidgetLearnerAction } from "@/lib/activities/widget-transition";
import type { InteractiveWidgetPayload } from "@/lib/activities/widgets";

interface Props {
  params: Promise<{ sessionId: string }>;
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

        if (attemptData.status === "submitted") setSubmitted(true);
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
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
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
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Loading activity…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-sm text-destructive">{error ?? "Activity not found."}</p>
        <Link href="/learner">
          <Button variant="outline" size="sm">Back to activities</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/learner" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to activities
      </Link>

      <ActivityRenderer
        definition={session.definition}
        attempt={attempt}
        estimatedMinutes={session.estimatedMinutes}
        onAnswerChange={handleAnswerChange}
        onComponentFeedbackRequest={handleComponentFeedback}
        onComponentTransitionRequest={handleComponentTransition}
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

      {submitted && (
        <div className="flex justify-center pt-4">
          <Link href="/learner">
            <Button variant="outline">Back to activities</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
