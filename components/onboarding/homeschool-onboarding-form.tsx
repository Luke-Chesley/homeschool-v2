"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, CheckCircle2, Loader2, Type, Upload, X } from "lucide-react";

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

const intakeOptions: Array<{ value: FastPathIntakeRoute; label: string }> = [
  {
    value: "single_lesson",
    label: "I have a chapter, pages, or one lesson",
  },
  {
    value: "weekly_plan",
    label: "I have a weekly plan",
  },
  {
    value: "outline",
    label: "I have an outline or table of contents",
  },
  {
    value: "topic",
    label: "Start from a topic",
  },
  {
    value: "manual_shell",
    label: "Start with a simple shell",
  },
];

const DEFAULT_INTAKE_ROUTE: FastPathIntakeRoute = "single_lesson";
const UPLOAD_ACCEPT =
  "image/*,application/pdf,.pdf,.txt,.md,.csv,.json,.html,.htm,application/json,text/plain,text/csv,text/markdown";

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

function sourceInputPlaceholder() {
  return "Paste a lesson, weekly plan, outline, chapter pages, topic idea, or anything else you already have.";
}

function resolveUploadModality(
  file: File,
  source: "camera" | "upload",
): Exclude<IntakeSourcePackageModality, "text" | "outline"> {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (source === "camera") {
    return "photo";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "pdf";
  }

  return "file";
}

function selectedSourceLabel(mode: IntakeSourcePackageModality, inputMode: "text" | "upload") {
  if (inputMode === "text") {
    return "Pasted text";
  }

  switch (mode) {
    case "photo":
      return "Photo";
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "file":
      return "File";
    default:
      return "Upload";
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
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const [step, setStep] = React.useState(1);
  const [learnerName, setLearnerName] = React.useState(props.defaultLearnerName ?? "");
  const [sourceMode, setSourceMode] = React.useState<IntakeSourcePackageModality>("text");
  const [sourceInputMode, setSourceInputMode] = React.useState<"text" | "upload">("text");
  const [sourceInput, setSourceInput] = React.useState("");
  const [sourceNote, setSourceNote] = React.useState("");
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [sourcePackage, setSourcePackage] = React.useState<NormalizedIntakeSourcePackage | null>(null);
  const [horizonIntent, setHorizonIntent] = React.useState<HorizonIntent>("today_only");
  const [preview, setPreview] = React.useState<HomeschoolFastPathPreview | null>(null);
  const [previewLearnerName, setPreviewLearnerName] = React.useState("");
  const [previewRoute, setPreviewRoute] = React.useState<FastPathIntakeRoute>(
    DEFAULT_INTAKE_ROUTE,
  );
  const [previewTitle, setPreviewTitle] = React.useState("");
  const [previewHorizon, setPreviewHorizon] = React.useState<CurriculumGenerationHorizon>("today");
  const [submitting, setSubmitting] = React.useState(false);
  const [jobState, setJobState] = React.useState<OnboardingJobState>({ stage: "idle" });
  const [error, setError] = React.useState<string | null>(null);

  const canContinueStep1 = learnerName.trim().length > 0;
  const usesTextInput = sourceInputMode === "text";
  const canContinueSourceStep = usesTextInput
    ? sourceInput.trim().length > 0
    : Boolean(uploadedFile);

  function markPackageStale() {
    setSourcePackage(null);
    setPreview(null);
    setError(null);
    setJobState({ stage: "idle" });
  }

  function setWorkingState(
    stage: Exclude<OnboardingJobStage, "idle" | "failed">,
    title: string,
    detail: string,
  ) {
    setJobState({ stage, title, detail });
  }

  function handleTextInputChange(value: string) {
    setSourceInput(value);
    if (value.trim().length > 0) {
      setSourceInputMode("text");
      setSourceMode("text");
    }
    markPackageStale();
  }

  function handleUploadSelection(file: File | null, source: "camera" | "upload") {
    setUploadedFile(file);
    if (file) {
      setSourceMode(resolveUploadModality(file, source));
      setSourceInputMode("upload");
    }
    markPackageStale();
  }

  function clearUploadedFile() {
    setUploadedFile(null);
    setSourceInputMode(sourceInput.trim().length > 0 ? "text" : "upload");
    if (sourceInput.trim().length > 0) {
      setSourceMode("text");
    }
    markPackageStale();
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
          modality: "text",
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
        setStep(3);
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
    if (step === 3 && preview) {
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
            Step {step} of 3 · Add one learner, one source, and open Today fast.
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
            <CardTitle>Paste or upload anything you have</CardTitle>
            <CardDescription>
              Skip the route choice. Share the quickest source and we&apos;ll interpret it from
              there.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
              <div className="grid gap-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                  <Type className="size-3.5" />
                  Use whichever source is fastest.
                </div>

                <label className="grid gap-1.5 text-sm font-medium">
                  Paste anything you already have
                  <textarea
                    value={sourceInput}
                    onChange={(event) => handleTextInputChange(event.target.value)}
                    rows={10}
                    placeholder={sourceInputPlaceholder()}
                    className="min-h-52 rounded-xl border border-input bg-background px-3 py-3 font-normal"
                  />
                  <span className="text-xs font-normal text-muted-foreground">
                    A lesson, weekly plan, outline, topic, copied page, or rough notes all work.
                  </span>
                </label>
              </div>

              <div className="grid gap-3">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept={UPLOAD_ACCEPT}
                  onChange={(event) =>
                    handleUploadSelection(event.target.files?.[0] ?? null, "upload")
                  }
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) =>
                    handleUploadSelection(event.target.files?.[0] ?? null, "camera")
                  }
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="grid gap-2 rounded-xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Upload className="size-4" />
                    Upload curriculum
                  </span>
                  <span className="text-sm text-muted-foreground">Files, images, or PDFs</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="grid gap-2 rounded-xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Camera className="size-4" />
                    Take photo
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Open the camera for a worksheet or page
                  </span>
                </button>

                {uploadedFile ? (
                  <div className="rounded-xl border border-border/60 bg-background/72 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{uploadedFile.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedSourceLabel(sourceMode, "upload")} ·{" "}
                          {uploadedFile.type || "Selected file"} · {formatFileSize(uploadedFile.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={clearUploadedFile}
                        className="size-8 shrink-0"
                        aria-label="Remove selected file"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      This upload stays ready if preparation fails, so you can retry directly.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                    No file selected yet.
                  </div>
                )}

                <div className="rounded-xl border border-border/60 bg-muted/35 px-4 py-3 text-xs text-muted-foreground">
                  {usesTextInput && sourceInput.trim().length > 0
                    ? "Using pasted text right now."
                    : uploadedFile
                      ? `Using the selected ${selectedSourceLabel(sourceMode, "upload").toLowerCase()} right now.`
                      : "Paste text or choose one upload to continue."}
                </div>
              </div>
            </div>

            <label className="grid gap-1.5 text-sm font-medium">
              Optional context
              <textarea
                value={sourceNote}
                onChange={(event) => {
                  setSourceNote(event.target.value);
                  markPackageStale();
                }}
                rows={3}
                placeholder="Optional: add any quick context we should keep in mind."
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
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full sm:w-auto">
                Back
              </Button>
              <Button
                type="button"
                disabled={!canContinueSourceStep || submitting}
                onClick={() => void submitFastPath(false)}
                className="min-h-11 w-full sm:min-h-10 sm:w-auto"
              >
                Review source and generate
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && preview ? (
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
              Use this as
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
            {preview.requestedRouteWasExplicit ? (
              <p>
                <span className="font-medium">Requested route:</span>{" "}
                {routeLabel(preview.requestedRoute)}
              </p>
            ) : null}
            <p>
              <span className="font-medium">Detected source kind:</span>{" "}
              {sourceKindLabels[preview.sourceKind]}
            </p>
            <p>
              <span className="font-medium">We&apos;ll use it as:</span>{" "}
              {routeLabel(preview.intakeRoute)}
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
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="w-full sm:w-auto">Edit source</Button>
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
                        ? usesTextInput
                          ? "Preparing text"
                          : "Preparing upload"
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
                  <p>{jobState.stage === "preview_ready" ? "Needs review" : step === 3 ? "Reviewing" : "Auto when needed"}</p>
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
                  onClick={() => void submitFastPath(step === 3 && preview !== null)}
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
