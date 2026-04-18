"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  IntakeSourcePackageModality,
  NormalizedIntakeSourcePackage,
} from "@/lib/homeschool/intake/types";
import { getBrowserStorageClient } from "@/lib/storage/client";
import { storageBuckets } from "@/lib/storage/buckets";
import { buildLearnerStoragePath } from "@/lib/storage/paths";

const UPLOAD_ACCEPT =
  "application/pdf,.pdf,.txt,.md,.csv,.json,.html,.htm,application/json,text/plain,text/csv,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx";
const MAX_VERCEL_MULTIPART_UPLOAD_BYTES = 4 * 1024 * 1024;

function resolveUploadModality(file: File): Exclude<IntakeSourcePackageModality, "text" | "outline"> {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "pdf";
  }

  return "file";
}

function summarizePackageStatus(pkg: NormalizedIntakeSourcePackage) {
  if (pkg.assetCount > 0) {
    return "Uploaded source is stored and ready to send to the model.";
  }
  return "Source package is ready.";
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

function sanitizeUploadFileName(fileName: string) {
  return (
    fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "upload"
  );
}

export function HomeschoolCurriculumIntakeForm(props: {
  organizationId?: string | null;
  activeLearnerId?: string | null;
  defaultSchoolYearLabel?: string | null;
  activeLearnerName: string;
}) {
  const router = useRouter();
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const [curriculumMode, setCurriculumMode] = React.useState<"manual_shell" | "paste_outline" | "ai_decompose">("manual_shell");
  const [sourceInputMode, setSourceInputMode] = React.useState<"text" | "upload">("text");
  const [curriculumTitle, setCurriculumTitle] = React.useState(`${props.activeLearnerName}'s Learning Plan`);
  const [curriculumSummary, setCurriculumSummary] = React.useState("");
  const [schoolYearLabel, setSchoolYearLabel] = React.useState(props.defaultSchoolYearLabel ?? "");
  const [subjects, setSubjects] = React.useState("Math, Language Arts, Science, History");
  const [teachingStyle, setTeachingStyle] = React.useState("");
  const [curriculumText, setCurriculumText] = React.useState("");
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [sourcePackage, setSourcePackage] = React.useState<NormalizedIntakeSourcePackage | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [preparingSource, setPreparingSource] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const usesUploadedSource = curriculumMode === "ai_decompose" && sourceInputMode === "upload";

  function markSourcePackageStale() {
    setSourcePackage(null);
  }

  function handleUploadSelection(file: File | null) {
    setUploadedFile(file);
    if (file) {
      setSourceInputMode("upload");
    }
    markSourcePackageStale();
  }

  async function createSourcePackage() {
    if (!uploadedFile) {
      throw new Error("Choose a file before adding this source.");
    }

    setPreparingSource(true);
    try {
      const modality = resolveUploadModality(uploadedFile);

      if (props.organizationId && props.activeLearnerId) {
        const storagePath = buildLearnerStoragePath(
          props.organizationId,
          props.activeLearnerId,
          "intake-packages",
          crypto.randomUUID(),
          sanitizeUploadFileName(uploadedFile.name),
        );
        const storage = getBrowserStorageClient().from(storageBuckets.learnerUploads);
        const upload = await storage.upload(storagePath, uploadedFile, {
          contentType: uploadedFile.type || "application/octet-stream",
          upsert: false,
        });

        if (upload.error) {
          throw new Error(upload.error.message);
        }

        const response = await fetch("/api/homeschool/intake-package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modality,
            fileName: uploadedFile.name,
            mimeType: uploadedFile.type || "application/octet-stream",
            byteSize: uploadedFile.size,
            storageBucket: storageBuckets.learnerUploads,
            storagePath,
            note: curriculumSummary.trim() || undefined,
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          void storage.remove([storagePath]).catch(() => undefined);
          throw new Error(payload?.error ?? "Could not upload that source.");
        }

        const preparedPackage = payload as NormalizedIntakeSourcePackage;
        setSourcePackage(preparedPackage);
        return preparedPackage;
      }

      if (uploadedFile.size > MAX_VERCEL_MULTIPART_UPLOAD_BYTES) {
        throw new Error(
          "This file is too large for the hosted fallback upload. Add it from Curriculum with an active learner selected, or keep the file under 4 MB.",
        );
      }

      const formData = new FormData();
      formData.set("modality", modality);
      formData.set("file", uploadedFile);
      if (curriculumSummary.trim()) {
        formData.set("note", curriculumSummary.trim());
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
      return preparedPackage;
    } finally {
      setPreparingSource(false);
    }
  }

  async function waitForJob(jobId: string) {
    setJobStatus("Building the source...");

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await fetch(`/api/ai/jobs/${jobId}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not load job status.");
      }

      if (payload?.status === "completed") {
        return payload;
      }

      if (payload?.status === "failed") {
        throw new Error(payload?.errorMessage ?? "Could not finish building this source.");
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error("Building this source took too long. Please try again.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    let preparedPackage: NormalizedIntakeSourcePackage | null = null;

    try {
      if (usesUploadedSource) {
        preparedPackage = sourcePackage ?? (await createSourcePackage());
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not prepare that source.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/homeschool/curriculum-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolYearLabel,
        subjects: subjects
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        teachingStyle,
        curriculumMode,
        curriculumTitle,
        curriculumSummary,
        curriculumText: usesUploadedSource ? undefined : curriculumText,
        sourcePackageIds: preparedPackage ? [preparedPackage.id] : undefined,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Could not add this source.");
      setSubmitting(false);
      return;
    }

    if (payload?.mode === "queued" && payload?.jobId) {
      try {
        const result = await waitForJob(payload.jobId);
        router.push(result?.output?.redirectTo ?? "/curriculum");
      } catch (jobError) {
        setError(jobError instanceof Error ? jobError.message : "Could not finish adding this source.");
        setSubmitting(false);
        setJobStatus(null);
        return;
      }
    } else {
      router.push(`/curriculum/${payload.sourceId}`);
    }
    router.refresh();
    setJobStatus(null);
    setSubmitting(false);
  }

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Add a curriculum source</CardTitle>
          <CardDescription>
            Start with a topic, paste an outline, or build from source material you already have.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">How do you want to start?</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "manual_shell", label: "Start from a topic" },
                { value: "paste_outline", label: "Paste outline" },
                { value: "ai_decompose", label: "Build from source" },
              ].map((option) => {
                const active = curriculumMode === option.value;
                const inputId = `curriculum-intake-mode-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={inputId}
                    onClick={() => {
                      setCurriculumMode(option.value as typeof curriculumMode);
                      if (option.value !== "ai_decompose") {
                        setSourceInputMode("text");
                      }
                    }}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name="curriculumMode"
                      value={option.value}
                      checked={active}
                      onChange={() => {
                        setCurriculumMode(option.value as typeof curriculumMode);
                        if (option.value !== "ai_decompose") {
                          setSourceInputMode("text");
                        }
                      }}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Source title
              <input
                value={curriculumTitle}
                onChange={(event) => setCurriculumTitle(event.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              School year
              <input
                value={schoolYearLabel}
                onChange={(event) => setSchoolYearLabel(event.target.value)}
                placeholder="2026-2027"
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-medium">
            Subjects
            <input
              value={subjects}
              onChange={(event) => setSubjects(event.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Notes
            <input
              value={curriculumSummary}
              onChange={(event) => {
                setCurriculumSummary(event.target.value);
                if (usesUploadedSource) {
                  markSourcePackageStale();
                }
              }}
              placeholder="What this source is meant to cover"
              className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Teaching style
            <input
              value={teachingStyle}
              onChange={(event) => setTeachingStyle(event.target.value)}
              placeholder="Structured, project-based, gentle..."
              className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
            />
          </label>

          {curriculumMode === "ai_decompose" ? (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">How should we send the source?</legend>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "text", label: "Paste text" },
                  { value: "upload", label: "Upload file" },
                ].map((option) => {
                  const active = sourceInputMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSourceInputMode(option.value as typeof sourceInputMode);
                        markSourcePackageStale();
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {curriculumMode !== "manual_shell" && !usesUploadedSource ? (
            <label className="grid gap-1.5 text-sm font-medium">
              {curriculumMode === "ai_decompose" ? "Source material" : "Outline"}
              <textarea
                value={curriculumText}
                onChange={(event) => {
                  setCurriculumText(event.target.value);
                  if (curriculumMode === "ai_decompose") {
                    setSourcePackage(null);
                  }
                }}
                rows={12}
                placeholder={
                  curriculumMode === "ai_decompose"
                    ? "Paste a chapter, lesson notes, table of contents, or plan text from what you already have."
                    : "# Unit 1\n- Lesson 1\n- Lesson 2"
                }
                className="rounded-2xl border border-input bg-background px-3 py-3 font-normal"
              />
            </label>
          ) : null}

          {usesUploadedSource ? (
            <div className="grid gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4">
              <input
                ref={uploadInputRef}
                type="file"
                accept={UPLOAD_ACCEPT}
                className="hidden"
                onChange={(event) => handleUploadSelection(event.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => uploadInputRef.current?.click()}>
                  {uploadedFile ? "Replace file" : "Choose file"}
                </Button>
                {uploadedFile ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      handleUploadSelection(null);
                      if (uploadInputRef.current) {
                        uploadInputRef.current.value = "";
                      }
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>

              {uploadedFile ? (
                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">{uploadedFile.name}</p>
                  <p className="text-muted-foreground">
                    {uploadedFile.type || "Selected file"} · {formatFileSize(uploadedFile.size)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload a PDF or supported document and it will be sent to the model directly.
                </p>
              )}

              {sourcePackage ? (
                <p className="text-sm text-muted-foreground">{summarizePackageStatus(sourcePackage)}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}
      {jobStatus ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{jobStatus}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || preparingSource || (usesUploadedSource && !uploadedFile)}>
          {submitting || preparingSource ? "Adding source..." : "Add source"}
        </Button>
      </div>
    </form>
  );
}
