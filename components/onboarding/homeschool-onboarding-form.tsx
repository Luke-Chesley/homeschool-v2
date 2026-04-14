"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CurriculumGenerationHorizon,
  FastPathIntakeRoute,
  HomeschoolFastPathPreview,
} from "@/lib/homeschool/onboarding/types";

type HorizonIntent = "today_only" | "auto";

const intakeOptions: Array<{ value: FastPathIntakeRoute; label: string; description: string }> = [
  {
    value: "single_lesson",
    label: "I have a chapter, pages, or one lesson",
    description: "Use one assignment or one day of material without forcing a fake week.",
  },
  {
    value: "weekly_plan",
    label: "I have a weekly plan",
    description: "Paste your week notes and we will shape a bounded current week.",
  },
  {
    value: "outline",
    label: "I have an outline or table of contents",
    description: "Turn a sequence or outline into the next few school days.",
  },
  {
    value: "topic",
    label: "Start from a topic",
    description: "Build a bounded starter module around one topic.",
  },
  {
    value: "manual_shell",
    label: "Start with a simple shell",
    description: "Use a light starter structure when you want to scaffold slowly.",
  },
];

const horizonLabels: Record<CurriculumGenerationHorizon, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  next_few_days: "Next few days",
  current_week: "Current week",
  starter_module: "Starter module",
  starter_week: "Starter week",
};

export function HomeschoolOnboardingForm(props: {
  organizationName: string;
  defaultLearnerName?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [learnerName, setLearnerName] = React.useState(props.defaultLearnerName ?? "");
  const [intakeRoute, setIntakeRoute] = React.useState<FastPathIntakeRoute>("single_lesson");
  const [sourceInput, setSourceInput] = React.useState("");
  const [horizonIntent, setHorizonIntent] = React.useState<HorizonIntent>("today_only");
  const [preview, setPreview] = React.useState<HomeschoolFastPathPreview | null>(null);
  const [previewLearnerName, setPreviewLearnerName] = React.useState("");
  const [previewRoute, setPreviewRoute] = React.useState<FastPathIntakeRoute>("single_lesson");
  const [previewTitle, setPreviewTitle] = React.useState("");
  const [previewHorizon, setPreviewHorizon] = React.useState<CurriculumGenerationHorizon>("today");
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
        intakeRoute,
        sourceInput,
        horizonIntent,
        confirmPreview,
        previewCorrections: confirmPreview
          ? {
              learnerName: previewLearnerName,
              intakeRoute: previewRoute,
              title: previewTitle,
              chosenHorizon: previewHorizon,
            }
          : undefined,
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
      setPreviewLearnerName(payload.preview.learnerTarget);
      setPreviewRoute(payload.preview.intakeRoute);
      setPreviewTitle(payload.preview.title);
      setPreviewHorizon(payload.preview.chosenHorizon);
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
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canContinueStep1}
                className="w-full sm:w-auto"
              >
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
                onClick={() => setIntakeRoute(option.value)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  intakeRoute === option.value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <p className="text-sm font-medium leading-5">{option.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
              </button>
            ))}
            <p className="text-xs text-muted-foreground">Add another learner later.</p>
            <div className="grid gap-2 sm:flex sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full sm:w-auto">
                Back
              </Button>
              <Button type="button" onClick={() => setStep(3)} className="w-full sm:w-auto">Continue</Button>
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
                  intakeRoute === "topic"
                    ? "Fractions with food examples"
                    : intakeRoute === "weekly_plan"
                      ? "Monday: read chapter 4, workbook page 42. Wednesday: quiz review. Friday: lab notes."
                      : intakeRoute === "outline"
                        ? "Unit 1\n- Fractions\n- Decimals\n- Percents"
                        : intakeRoute === "manual_shell"
                          ? "Math, reading, science"
                    : "Chapter 4 pages 88-95, workbook pg 42, quiz Friday"
                }
                className="min-h-44 rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Planning horizon</legend>
              <label className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="horizon"
                  checked={horizonIntent === "today_only"}
                  onChange={() => setHorizonIntent("today_only")}
                  className="mt-1"
                />
                <span>Use this for just today</span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="horizon"
                  checked={horizonIntent === "auto"}
                  onChange={() => setHorizonIntent("auto")}
                  className="mt-1"
                />
                <span>Auto-expand when the source clearly supports more than today</span>
              </label>
            </fieldset>

            <div className="grid gap-2 sm:flex sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="w-full sm:w-auto">
                Back
              </Button>
              <Button
                type="button"
                disabled={!canContinueStep3 || submitting}
                onClick={() => void submitFastPath(false)}
                className="w-full sm:w-auto"
              >
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
              Confidence is {preview.confidence}. Correct anything obvious before we save and open
              Today.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <label className="grid gap-1.5 font-medium">
              Learner
              <input
                value={previewLearnerName}
                onChange={(event) => setPreviewLearnerName(event.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1.5 font-medium">
              Intake route
              <select
                value={previewRoute}
                onChange={(event) => setPreviewRoute(event.target.value as FastPathIntakeRoute)}
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              >
                {intakeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 font-medium">
              Title
              <input
                value={previewTitle}
                onChange={(event) => setPreviewTitle(event.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1.5 font-medium">
              Planning horizon
              <select
                value={previewHorizon}
                onChange={(event) =>
                  setPreviewHorizon(event.target.value as CurriculumGenerationHorizon)
                }
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              >
                {Object.entries(horizonLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p>
              <span className="font-medium">Suggested horizon:</span>{" "}
              {horizonLabels[preview.inferredHorizon]}
            </p>
            <div>
              <p className="font-medium">Detected chunks</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {preview.detectedChunks.map((chunk) => (
                  <li key={chunk}>{chunk}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">Assumptions</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {preview.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-2 sm:flex sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(3)} className="w-full sm:w-auto">Edit source</Button>
              <Button type="button" disabled={submitting} onClick={() => void submitFastPath(true)} className="w-full sm:w-auto">
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
