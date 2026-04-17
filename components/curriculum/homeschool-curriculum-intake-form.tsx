"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HomeschoolCurriculumIntakeForm(props: {
  defaultSchoolYearLabel?: string | null;
  activeLearnerName: string;
}) {
  const router = useRouter();
  const [curriculumMode, setCurriculumMode] = React.useState<"manual_shell" | "paste_outline" | "ai_decompose">("manual_shell");
  const [curriculumTitle, setCurriculumTitle] = React.useState(`${props.activeLearnerName}'s Learning Plan`);
  const [curriculumSummary, setCurriculumSummary] = React.useState("");
  const [schoolYearLabel, setSchoolYearLabel] = React.useState(props.defaultSchoolYearLabel ?? "");
  const [subjects, setSubjects] = React.useState("Math, Language Arts, Science, History");
  const [teachingStyle, setTeachingStyle] = React.useState("");
  const [curriculumText, setCurriculumText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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
        curriculumText,
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
                    onClick={() => setCurriculumMode(option.value as typeof curriculumMode)}
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
                      onChange={() => setCurriculumMode(option.value as typeof curriculumMode)}
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
              onChange={(event) => setCurriculumSummary(event.target.value)}
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

          {curriculumMode !== "manual_shell" ? (
            <label className="grid gap-1.5 text-sm font-medium">
              {curriculumMode === "ai_decompose" ? "Source material" : "Outline"}
              <textarea
                value={curriculumText}
                onChange={(event) => setCurriculumText(event.target.value)}
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
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}
      {jobStatus ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{jobStatus}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding source..." : "Add source"}
        </Button>
      </div>
    </form>
  );
}
