"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CurriculumGenerationHorizon,
  FastPathIntakeRoute,
  HomeschoolFastPathPreview,
} from "@/lib/homeschool/onboarding/types";
import type {
  IntakeSourcePackageModality,
  NormalizedIntakeSourcePackage,
} from "@/lib/homeschool/intake/types";

type HorizonIntent = "today_only" | "auto";
type OnboardingJobStage =
  | "idle"
  | "preparing_source"
  | "uploading_source"
  | "source_ready"
  | "preview_ready"
  | "generating_first_day"
  | "failed";

type OnboardingJobState = {
  stage: OnboardingJobStage;
  title?: string;
  detail?: string;
};

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

const sourceModeOptions: Array<{
  value: IntakeSourcePackageModality;
  label: string;
  description: string;
}> = [
  {
    value: "text",
    label: "Paste text",
    description: "Use typed instructions, copied pages, or a plain description.",
  },
  {
    value: "outline",
    label: "Paste outline",
    description: "Use a table of contents or a sequenced outline.",
  },
  {
    value: "photo",
    label: "Take photo",
    description: "Capture a worksheet or assignment page from your phone.",
  },
  {
    value: "image",
    label: "Upload image",
    description: "Use an existing photo or screenshot.",
  },
  {
    value: "pdf",
    label: "Upload PDF",
    description: "Use a PDF assignment sheet or curriculum page.",
  },
  {
    value: "file",
    label: "Upload file",
    description: "Use a text, markdown, CSV, or other document file.",
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

const sourceKindLabels: Record<HomeschoolFastPathPreview["sourceKind"], string> = {
  single_day_material: "Single day material",
  weekly_assignments: "Weekly assignments",
  sequence_outline: "Sequence outline",
  topic_seed: "Topic seed",
  manual_shell: "Manual shell",
  ambiguous: "Ambiguous",
};

function routeLabel(value: FastPathIntakeRoute) {
  return intakeOptions.find((option) => option.value === value)?.label ?? value;
}

function placeholderForRoute(route: FastPathIntakeRoute) {
  switch (route) {
    case "topic":
      return "Fractions with food examples";
    case "weekly_plan":
      return "Monday: read chapter 4, workbook page 42. Wednesday: quiz review. Friday: lab notes.";
    case "outline":
      return "Unit 1\n- Fractions\n- Decimals\n- Percents";
    case "manual_shell":
      return "Math, reading, science";
    default:
      return "Chapter 4 pages 88-95, workbook pg 42, quiz Friday";
  }
}

function acceptForSourceMode(mode: IntakeSourcePackageModality) {
  switch (mode) {
    case "photo":
    case "image":
      return "image/*";
    case "pdf":
      return "application/pdf,.pdf";
    case "file":
      return ".txt,.md,.csv,.json,.html,.htm,application/json,text/plain,text/csv,text/markdown";
    default:
      return undefined;
  }
}

function noteLabelForSourceMode(mode: IntakeSourcePackageModality) {
  switch (mode) {
    case "photo":
      return "Photo note";
    case "image":
      return "Image note";
    case "pdf":
      return "PDF note";
    case "file":
      return "File note";
    default:
      return "Note";
  }
}

function notePlaceholderForSourceMode(mode: IntakeSourcePackageModality) {
  switch (mode) {
    case "photo":
    case "image":
      return "Summarize what is on this page so we have usable launch context.";
    case "pdf":
      return "Optional: add a short note if the PDF needs extra context.";
    case "file":
      return "Optional: add a short note if the file needs extra context.";
    default:
      return "";
  }
}

function summarizePackageStatus(pkg: NormalizedIntakeSourcePackage) {
  if (pkg.extractionStatus === "requires_review") {
    return "Using the extracted text plus your note for this source.";
  }
  if (pkg.assetCount > 0) {
    return "Uploaded source is stored and normalized for preview.";
  }
  return "Text source is normalized and ready for preview.";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 102.4) / 10} KB`;
  }

  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

export function HomeschoolOnboardingForm(props: {
  organizationName: string;
  defaultLearnerName?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [learnerName, setLearnerName] = React.useState(props.defaultLearnerName ?? "");
  const [intakeRoute, setIntakeRoute] = React.useState<FastPathIntakeRoute>("single_lesson");
  const [sourceMode, setSourceMode] = React.useState<IntakeSourcePackageModality>("text");
  const [sourceInput, setSourceInput] = React.useState("");
  const [sourceNote, setSourceNote] = React.useState("");
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [sourcePackage, setSourcePackage] = React.useState<NormalizedIntakeSourcePackage | null>(null);
  const [horizonIntent, setHorizonIntent] = React.useState<HorizonIntent>("today_only");
  const [preview, setPreview] = React.useState<HomeschoolFastPathPreview | null>(null);
  const [previewLearnerName, setPreviewLearnerName] = React.useState("");
  const [previewRoute, setPreviewRoute] = React.useState<FastPathIntakeRoute>("single_lesson");
  const [previewTitle, setPreviewTitle] = React.useState("");
  const [previewHorizon, setPreviewHorizon] = React.useState<CurriculumGenerationHorizon>("today");
  const [submitting, setSubmitting] = React.useState(false);
  const [jobState, setJobState] = React.useState<OnboardingJobState>({ stage: "idle" });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (intakeRoute === "outline" && sourceMode === "text") {
      setSourceMode("outline");
      return;
    }

    if (intakeRoute !== "outline" && sourceMode === "outline") {
      setSourceMode("text");
    }
  }, [intakeRoute, sourceMode]);

  const canContinueStep1 = learnerName.trim().length > 0;
  const noteRequired = sourceMode === "photo" || sourceMode === "image";
  const usesTextInput = sourceMode === "text" || sourceMode === "outline";
  const canContinueStep3 = usesTextInput
    ? sourceInput.trim().length > 0
    : Boolean(uploadedFile) && (!noteRequired || sourceNote.trim().length > 0);

  function markPackageStale() {
    setSourcePackage(null);
    setJobState({ stage: "idle" });
  }

  function setWorkingState(
    stage: Exclude<OnboardingJobStage, "idle" | "failed">,
    title: string,
    detail: string,
  ) {
    setJobState({ stage, title, detail });
  }

  async function createSourcePackage() {
    if (usesTextInput) {
      setWorkingState(
        "preparing_source",
        "Preparing your source",
        "Normalizing the pasted material before we build Today.",
      );
      const response = await fetch("/api/homeschool/intake-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modality: sourceMode,
          text: sourceInput,
          note: sourceNote.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not prepare that source.");
      }

      const preparedPackage = payload as NormalizedIntakeSourcePackage;
      setSourcePackage(preparedPackage);
      setWorkingState(
        "source_ready",
        "Source package ready",
        summarizePackageStatus(preparedPackage),
      );
      return preparedPackage;
    }

    if (!uploadedFile) {
      throw new Error("Choose a file before continuing.");
    }

    setWorkingState(
      "uploading_source",
      "Uploading your source",
      "Keeping the selected file in place while we prepare the intake package.",
    );

    const formData = new FormData();
    formData.set("modality", sourceMode);
    formData.set("file", uploadedFile);
    if (sourceNote.trim()) {
      formData.set("note", sourceNote.trim());
    }

    const response = await fetch("/api/homeschool/intake-package", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error ?? "Could not upload that source.");
    }

    const preparedPackage = payload as NormalizedIntakeSourcePackage;
    setSourcePackage(preparedPackage);
    setWorkingState(
      "source_ready",
      "Source package ready",
      summarizePackageStatus(preparedPackage),
    );
    return preparedPackage;
  }

  async function submitFastPath(confirmPreview = false) {
    setSubmitting(true);
    setError(null);

    try {
      const preparedPackage = sourcePackage ?? (await createSourcePackage());
      setWorkingState(
        "generating_first_day",
        "Preparing your first day",
        "Building Today now, then chaining lesson and activity generation automatically.",
      );

      const response = await fetch("/api/homeschool/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerName,
          intakeRoute,
          sourcePackageId: preparedPackage.id,
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
        throw new Error(payload?.error ?? "Could not finish onboarding.");
      }

      if (payload?.mode === "preview_required") {
        setPreview(payload.preview);
        setPreviewLearnerName(payload.preview.learnerTarget);
        setPreviewRoute(payload.preview.intakeRoute);
        setPreviewTitle(payload.preview.title);
        setPreviewHorizon(payload.preview.chosenHorizon);
        setStep(4);
        setSubmitting(false);
        setWorkingState(
          "preview_ready",
          "Quick preview ready",
          "Confirm the interpretation before we save the route and open Today.",
        );
        return;
      }

      router.push(payload?.redirectTo ?? "/today");
      router.refresh();
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Could not finish onboarding.";
      setError(message);
      setJobState({
        stage: "failed",
        title: "Could not finish this step",
        detail: message,
      });
      setSubmitting(false);
      return;
    }
  }

  function renderJobIcon() {
    if (jobState.stage === "failed") {
      return <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />;
    }

    if (
      jobState.stage === "preparing_source" ||
      jobState.stage === "uploading_source" ||
      jobState.stage === "generating_first_day"
    ) {
      return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />;
    }

    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />;
  }

  function getRetryLabel() {
    if (step === 4 && preview) {
      return "Retry save and open Today";
    }

    if (!usesTextInput && uploadedFile) {
      return "Retry with this file";
    }

    return sourcePackage ? "Retry generate" : "Retry this step";
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
                className="min-h-11 rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
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
                onClick={() => {
                  setIntakeRoute(option.value);
                  markPackageStale();
                }}
                className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${
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
            <CardDescription>
              Build a source package first. We&apos;ll show you the normalized input before we save
              and open Today.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {sourceModeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSourceMode(option.value);
                    setUploadedFile(null);
                    markPackageStale();
                  }}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    sourceMode === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-medium leading-5">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>

            {usesTextInput ? (
              <label className="grid gap-1.5 text-sm font-medium">
                {sourceMode === "outline" ? "Outline input" : "Source input"}
                <textarea
                  value={sourceInput}
                  onChange={(event) => {
                    setSourceInput(event.target.value);
                    markPackageStale();
                  }}
                  rows={8}
                  placeholder={placeholderForRoute(intakeRoute)}
                  className="min-h-44 rounded-xl border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
            ) : (
              <label className="grid gap-1.5 text-sm font-medium">
                Upload
                <input
                  key={sourceMode}
                  type="file"
                  accept={acceptForSourceMode(sourceMode)}
                  capture={sourceMode === "photo" ? "environment" : undefined}
                  onChange={(event) => {
                    setUploadedFile(event.target.files?.[0] ?? null);
                    markPackageStale();
                  }}
                  className="min-h-11 rounded-xl border border-dashed border-input bg-background px-3 py-3 font-normal"
                />
                <span className="text-xs font-normal text-muted-foreground">
                  {uploadedFile
                    ? `Selected: ${uploadedFile.name}`
                    : sourceMode === "photo"
                      ? "Use the camera or choose a photo."
                      : "Choose one file to normalize before preview."}
                </span>
              </label>
            )}

            {!usesTextInput && uploadedFile ? (
              <div className="rounded-xl border border-border/60 bg-background/72 p-4 text-sm">
                <p className="font-medium text-foreground">{uploadedFile.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {uploadedFile.type || "Selected file"} · {formatFileSize(uploadedFile.size)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  This stays selected if upload or preparation fails, so you can retry directly.
                </p>
              </div>
            ) : null}

            <label className="grid gap-1.5 text-sm font-medium">
              {noteLabelForSourceMode(sourceMode)}
              <textarea
                value={sourceNote}
                onChange={(event) => {
                  setSourceNote(event.target.value);
                  markPackageStale();
                }}
                rows={3}
                placeholder={notePlaceholderForSourceMode(sourceMode)}
                className="min-h-28 rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>

            {sourcePackage ? (
              <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm">
                <p className="font-medium">Prepared source package</p>
                <p className="mt-1 text-muted-foreground">{sourcePackage.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">{summarizePackageStatus(sourcePackage)}</p>
              </div>
            ) : null}

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Planning horizon</legend>
              <label className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="horizon"
                  checked={horizonIntent === "today_only"}
                  onChange={() => setHorizonIntent("today_only")}
                  className="mt-1 size-4"
                />
                <span>Use this for just today</span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="horizon"
                  checked={horizonIntent === "auto"}
                  onChange={() => setHorizonIntent("auto")}
                  className="mt-1 size-4"
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
                className="min-h-11 w-full sm:min-h-10 sm:w-auto"
              >
                Review source and generate
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
            {sourcePackage ? (
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="font-medium">Normalized source package</p>
                <p className="mt-1 text-muted-foreground">{sourcePackage.summary}</p>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  <p>Mode: {sourcePackage.modality}</p>
                  <p>Assets: {sourcePackage.assetCount}</p>
                  <p>Extraction: {sourcePackage.extractionStatus.replaceAll("_", " ")}</p>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {sourcePackage.normalizedText.slice(0, 280)}
                  {sourcePackage.normalizedText.length > 280 ? "…" : ""}
                </p>
              </div>
            ) : null}

            <label className="grid gap-1.5 font-medium">
              Learner
              <input
                value={previewLearnerName}
                onChange={(event) => setPreviewLearnerName(event.target.value)}
                className="min-h-11 rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 font-medium">
              Intake route
              <select
                value={previewRoute}
                onChange={(event) => setPreviewRoute(event.target.value as FastPathIntakeRoute)}
                className="min-h-11 rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
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
                className="min-h-11 rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 font-medium">
              Planning horizon
              <select
                value={previewHorizon}
                onChange={(event) =>
                  setPreviewHorizon(event.target.value as CurriculumGenerationHorizon)
                }
                className="min-h-11 rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
              >
                {Object.entries(horizonLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p>
              <span className="font-medium">Requested route:</span> {routeLabel(preview.requestedRoute)}
            </p>
            <p>
              <span className="font-medium">Detected source kind:</span>{" "}
              {sourceKindLabels[preview.sourceKind]}
            </p>
            <p>
              <span className="font-medium">Routing now:</span> {routeLabel(preview.intakeRoute)}
            </p>
            <p>
              <span className="font-medium">Suggested horizon:</span>{" "}
              {horizonLabels[preview.inferredHorizon]}
            </p>
            {preview.followUpQuestion ? (
              <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-muted-foreground">
                <p className="font-medium text-foreground">Check before save</p>
                <p className="mt-1">{preview.followUpQuestion}</p>
              </div>
            ) : null}
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
              <Button type="button" disabled={submitting} onClick={() => void submitFastPath(true)} className="min-h-11 w-full sm:min-h-10 sm:w-auto">
                Save and open Today
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {jobState.stage !== "idle" ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            jobState.stage === "failed"
              ? "border-destructive/20 bg-destructive/10"
              : "border-border/60 bg-muted/60"
          }`}
        >
          <div className="flex items-start gap-3">
            {renderJobIcon()}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <p className="font-medium text-foreground">{jobState.title}</p>
                {jobState.detail ? (
                  <p className="text-muted-foreground">{jobState.detail}</p>
                ) : null}
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <p className="font-medium text-foreground">Source</p>
                  <p>
                    {jobState.stage === "uploading_source"
                      ? "Uploading file"
                      : jobState.stage === "preparing_source"
                        ? "Preparing text"
                        : sourcePackage ||
                            jobState.stage === "source_ready" ||
                            jobState.stage === "preview_ready" ||
                            jobState.stage === "generating_first_day"
                          ? "Ready"
                          : "Waiting"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <p className="font-medium text-foreground">Preview</p>
                  <p>{jobState.stage === "preview_ready" ? "Needs review" : step === 4 ? "Reviewing" : "Auto when needed"}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <p className="font-medium text-foreground">Today build</p>
                  <p>{jobState.stage === "generating_first_day" ? "In progress" : "Pending"}</p>
                </div>
              </div>
              {jobState.stage === "failed" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void submitFastPath(step === 4 && preview !== null)}
                  disabled={submitting}
                  className="min-h-11 w-full sm:min-h-10 sm:w-auto"
                >
                  {getRetryLabel()}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
