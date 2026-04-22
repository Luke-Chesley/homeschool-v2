"use client";

import * as React from "react";
import { FileText, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NormalizedIntakeSourcePackage } from "@/lib/homeschool/intake/types";
import {
  COMMON_SOURCE_UPLOAD_ACCEPT,
  resolveUploadModality,
} from "@/lib/homeschool/intake/upload-formats";
import { createBrowserSupabaseClient } from "@/lib/platform/supabase-browser";
import { storageBuckets } from "@/lib/storage/buckets";
import { buildLearnerStoragePath } from "@/lib/storage/paths";

const MAX_VERCEL_MULTIPART_UPLOAD_BYTES = 4 * 1024 * 1024;

function summarizePackageStatus(pkg: NormalizedIntakeSourcePackage) {
  if (pkg.assetCount > 0) {
    return "Uploaded source is stored and ready for interpretation.";
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

function deriveTitleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function deriveTitleFromText(sourceText: string) {
  const firstLine = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ? firstLine.slice(0, 80) : null;
}

function buildSelectedSourceCopy(params: {
  hasText: boolean;
  hasUpload: boolean;
  sourcePackage: NormalizedIntakeSourcePackage | null;
}) {
  if (params.hasText && params.hasUpload) {
    return "We’ll use the pasted text together with the selected file.";
  }
  if (params.hasUpload) {
    return params.sourcePackage
      ? "We’ll use the prepared upload."
      : "We’ll use the selected upload.";
  }
  if (params.hasText) {
    return "We’ll use the pasted text.";
  }
  return "Paste text, choose a file, or do both.";
}

export function HomeschoolCurriculumIntakeForm(props: {
  organizationId?: string | null;
  activeLearnerId?: string | null;
  activeLearnerName: string;
}) {
  const router = useRouter();
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const defaultTitle = `${props.activeLearnerName}'s Learning Plan`;

  const [curriculumSummary, setCurriculumSummary] = React.useState("");
  const [teachingStyle, setTeachingStyle] = React.useState("");
  const [curriculumText, setCurriculumText] = React.useState("");
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [sourcePackage, setSourcePackage] = React.useState<NormalizedIntakeSourcePackage | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [preparingSource, setPreparingSource] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const hasTextSource = curriculumText.trim().length > 0;
  const hasUploadSource = uploadedFile !== null;
  const canSubmit = hasTextSource || hasUploadSource || sourcePackage !== null;

  function markSourcePackageStale() {
    setSourcePackage(null);
  }

  function clearUploadedFile() {
    setUploadedFile(null);
    setSourcePackage(null);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  function handleUploadSelection(file: File | null) {
    setUploadedFile(file);
    setSourcePackage(null);
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
        const storage = createBrowserSupabaseClient().storage.from(storageBuckets.learnerUploads);
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
          "This file is too large for the hosted fallback upload. Keep the file under 4 MB or add it with an active learner selected.",
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Paste source material, upload a file, or do both.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setJobStatus("Interpreting the source and naming the curriculum...");

    let preparedPackage: NormalizedIntakeSourcePackage | null = sourcePackage;

    try {
      if (uploadedFile && !preparedPackage) {
        preparedPackage = await createSourcePackage();
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not prepare that source.");
      setSubmitting(false);
      return;
    }

    const curriculumTitle =
      (uploadedFile ? deriveTitleFromFileName(uploadedFile.name) : null) ??
      deriveTitleFromText(curriculumText) ??
      defaultTitle;

    const response = await fetch("/api/homeschool/curriculum-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjects: ["Integrated Studies"],
        teachingStyle,
        curriculumMode: "ai_decompose",
        curriculumTitle,
        curriculumSummary,
        curriculumText: hasTextSource ? curriculumText.trim() : undefined,
        sourcePackageIds: preparedPackage ? [preparedPackage.id] : undefined,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Could not add this source.");
      setSubmitting(false);
      return;
    }

    router.push(payload?.redirectTo ?? "/curriculum");

    router.refresh();
    setJobStatus(null);
    setSubmitting(false);
  }

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
      <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
        <CardHeader>
          <CardTitle>Add a curriculum source</CardTitle>
          <CardDescription>
            Paste or upload what you already have. We&apos;ll interpret the source and turn it into a
            live curriculum for {props.activeLearnerName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
            <div className="grid gap-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                <FileText className="size-3.5" />
                Paste whatever you have.
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                Source material
                <textarea
                  value={curriculumText}
                  onChange={(event) => setCurriculumText(event.target.value)}
                  rows={10}
                  placeholder="Paste a lesson, chapter, outline, schedule, topic notes, or any other source text."
                  className="min-h-52 rounded-xl border border-input bg-background px-3 py-3 font-normal"
                />
                <span className="text-xs font-normal text-muted-foreground">
                  A lesson, outline, workbook page, copied chapter, or rough notes all work.
                </span>
              </label>

              <div className="rounded-xl border border-border/60 bg-background/75 px-4 py-3 text-xs text-muted-foreground">
                <p>We&apos;ll run source interpretation first.</p>
                <p>Then we&apos;ll build the curriculum structure from that result.</p>
              </div>
            </div>

            <div className="grid gap-3">
              <input
                ref={uploadInputRef}
                type="file"
                accept={COMMON_SOURCE_UPLOAD_ACCEPT}
                onChange={(event) => handleUploadSelection(event.target.files?.[0] ?? null)}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="grid gap-2 rounded-xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Upload className="size-4" />
                  Upload source file
                </span>
                <span className="text-sm text-muted-foreground">PDFs, images, or documents</span>
              </button>

              {uploadedFile ? (
                <div className="rounded-xl border border-border/60 bg-background/72 p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{uploadedFile.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
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
                    This upload stays ready if interpretation fails, so you can retry directly.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                  No file selected yet.
                </div>
              )}

              <div className="rounded-xl border border-border/60 bg-muted/35 px-4 py-3 text-xs text-muted-foreground">
                {buildSelectedSourceCopy({
                  hasText: hasTextSource,
                  hasUpload: hasUploadSource,
                  sourcePackage,
                })}
              </div>
            </div>
          </div>

          <label className="grid gap-1.5 text-sm font-medium">
            Notes
            <textarea
              value={curriculumSummary}
              onChange={(event) => {
                setCurriculumSummary(event.target.value);
                if (uploadedFile) {
                  markSourcePackageStale();
                }
              }}
              rows={3}
              placeholder="What should this source cover, or what context should we keep in mind?"
              className="min-h-28 rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Teaching style
            <input
              value={teachingStyle}
              onChange={(event) => setTeachingStyle(event.target.value)}
              placeholder="Structured, project-based, gentle..."
              className="min-h-11 rounded-xl border border-input bg-background px-3 py-2.5 font-normal"
            />
          </label>

          {sourcePackage ? (
            <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm">
              <p className="font-medium">Prepared source package</p>
              <p className="mt-1 text-muted-foreground">{sourcePackage.summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {summarizePackageStatus(sourcePackage)}
              </p>
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
        <Button type="submit" disabled={submitting || preparingSource || !canSubmit}>
          {submitting || preparingSource ? "Preparing source..." : "Add source"}
        </Button>
      </div>
    </form>
  );
}
