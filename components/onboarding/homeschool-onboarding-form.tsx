"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type IntakeType = "book_curriculum" | "outline_weekly_plan" | "topic";
type HorizonIntent = "today_only" | "auto";

type PreviewPayload = {
  learnerTarget: string;
  intakeType: IntakeType;
  title: string;
  detectedChunks: string[];
  plannedHorizon: "today" | "next_few_days";
  confidence: "low" | "moderate";
};

const intakeOptions: Array<{ value: IntakeType; label: string; description: string }> = [
  {
    value: "book_curriculum",
    label: "I have a book or curriculum",
    description: "Share chapters, pages, or curriculum notes.",
  },
  {
    value: "outline_weekly_plan",
    label: "I have an outline or weekly plan",
    description: "Paste your weekly outline and we will shape the day.",
  },
  {
    value: "topic",
    label: "Start from a topic",
    description: "Give one topic and we will build a bounded starter day.",
  },
];

export function HomeschoolOnboardingForm(props: {
  organizationName: string;
  defaultLearnerName?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [learnerName, setLearnerName] = React.useState(props.defaultLearnerName ?? "");
  const [intakeType, setIntakeType] = React.useState<IntakeType>("book_curriculum");
  const [sourceInput, setSourceInput] = React.useState("");
  const [horizonIntent, setHorizonIntent] = React.useState<HorizonIntent>("today_only");
  const [preview, setPreview] = React.useState<PreviewPayload | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canContinueStep1 = learnerName.trim().length > 0;
  const canContinueStep3 = sourceInput.trim().length > 0;

  async function submitFastPath(confirmPreview = false) {
    setSubmitting(true);
    setError(null);
    setJobStatus("Preparing your first day...");

    const response = await fetch("/api/homeschool/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learnerName,
        intakeType,
        sourceInput,
        horizonIntent,
        confirmPreview,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Could not finish onboarding.");
      setSubmitting(false);
      setJobStatus(null);
      return;
    }

    if (payload?.mode === "preview_required") {
      setPreview(payload.preview);
      setStep(4);
      setSubmitting(false);
      setJobStatus(null);
      return;
    }

    router.push(payload?.redirectTo ?? "/today");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <Card className="quiet-panel border-border/60 bg-card/85 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle>Fast path to Today</CardTitle>
          <CardDescription>
            Step {step} of 4 · Add one learner, one source, and open Today fast.
          </CardDescription>
          <p className="text-xs text-muted-foreground">{props.organizationName}</p>
        </CardHeader>
      </Card>

      {step === 1 ? (
        <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
          <CardHeader>
            <CardTitle>Who are we planning for first?</CardTitle>
            <CardDescription>Start with one learner. You can add another learner later.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Learner name
              <input
                value={learnerName}
                onChange={(event) => setLearnerName(event.target.value)}
                placeholder="Ava"
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setStep(2)} disabled={!canContinueStep1}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
          <CardHeader>
            <CardTitle>What do you have right now?</CardTitle>
            <CardDescription>Pick the closest option. Keep it simple.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {intakeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setIntakeType(option.value)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  intakeType === option.value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
            <p className="text-xs text-muted-foreground">Add another learner later.</p>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" onClick={() => setStep(3)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
          <CardHeader>
            <CardTitle>Share one source</CardTitle>
            <CardDescription>Paste what you have. We&apos;ll shape a usable Today.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Source input
              <textarea
                value={sourceInput}
                onChange={(event) => setSourceInput(event.target.value)}
                rows={8}
                placeholder={
                  intakeType === "topic"
                    ? "Fractions with food examples"
                    : "Chapter 4 pages 88-95, workbook pg 42, quiz Friday"
                }
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Planning horizon</legend>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="horizon"
                  checked={horizonIntent === "today_only"}
                  onChange={() => setHorizonIntent("today_only")}
                />
                Use this for just today
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="horizon"
                  checked={horizonIntent === "auto"}
                  onChange={() => setHorizonIntent("auto")}
                />
                Auto-expand to next few days when confidence is high
              </label>
            </fieldset>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="button" disabled={!canContinueStep3 || submitting} onClick={() => void submitFastPath(false)}>
                Generate Today
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 && preview ? (
        <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
          <CardHeader>
            <CardTitle>Quick preview before save</CardTitle>
            <CardDescription>
              Confidence is {preview.confidence}. Confirm this looks right, then we&apos;ll save and open Today.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><span className="font-medium">Learner:</span> {preview.learnerTarget}</p>
            <p><span className="font-medium">Title:</span> {preview.title}</p>
            <p><span className="font-medium">Planned horizon:</span> {preview.plannedHorizon === "today" ? "Today" : "Next few days"}</p>
            <div>
              <p className="font-medium">Detected chunks</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {preview.detectedChunks.map((chunk) => (
                  <li key={chunk}>{chunk}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>Edit source</Button>
              <Button type="button" disabled={submitting} onClick={() => void submitFastPath(true)}>
                Save and open Today
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {jobStatus ? <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{jobStatus}</p> : null}

    </div>
  );
}
