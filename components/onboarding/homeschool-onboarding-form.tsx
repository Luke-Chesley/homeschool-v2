"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schoolDays = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
];

type LearnerDraft = {
  displayName: string;
  gradeLevel: string;
  ageBand: string;
  pacePreference: "gentle" | "balanced" | "accelerated";
  loadPreference: "light" | "balanced" | "ambitious";
};

export function HomeschoolOnboardingForm(props: {
  organizationName: string;
  defaultLearnerName?: string | null;
}) {
  const router = useRouter();
  const [householdName, setHouseholdName] = React.useState(props.organizationName);
  const [schoolYearLabel, setSchoolYearLabel] = React.useState("");
  const [termStartDate, setTermStartDate] = React.useState("");
  const [termEndDate, setTermEndDate] = React.useState("");
  const [preferredSchoolDays, setPreferredSchoolDays] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [dailyTimeBudgetMinutes, setDailyTimeBudgetMinutes] = React.useState(180);
  const [subjects, setSubjects] = React.useState("Math, Language Arts, Science, History");
  const [standardsPreference, setStandardsPreference] = React.useState("");
  const [teachingStyle, setTeachingStyle] = React.useState("");
  const [curriculumMode, setCurriculumMode] = React.useState<"manual_shell" | "paste_outline" | "ai_decompose">("manual_shell");
  const [curriculumTitle, setCurriculumTitle] = React.useState("Family Learning Plan");
  const [curriculumSummary, setCurriculumSummary] = React.useState("");
  const [curriculumText, setCurriculumText] = React.useState("");
  const [learners, setLearners] = React.useState<LearnerDraft[]>([
    {
      displayName: props.defaultLearnerName ?? "",
      gradeLevel: "",
      ageBand: "",
      pacePreference: "balanced",
      loadPreference: "balanced",
    },
  ]);
  const [submitting, setSubmitting] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function waitForJob(jobId: string) {
    setJobStatus("Generating curriculum...");

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
        throw new Error(payload?.errorMessage ?? "Curriculum generation failed.");
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error("Curriculum generation timed out.");
  }

  function toggleSchoolDay(day: number) {
    setPreferredSchoolDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort(),
    );
  }

  function updateLearner(index: number, patch: Partial<LearnerDraft>) {
    setLearners((current) =>
      current.map((learner, learnerIndex) =>
        learnerIndex === index ? { ...learner, ...patch } : learner,
      ),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/homeschool/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        householdName,
        schoolYearLabel,
        termStartDate,
        termEndDate,
        preferredSchoolDays,
        dailyTimeBudgetMinutes,
        subjects: subjects
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        standardsPreference,
        teachingStyle,
        learners: learners.filter((learner) => learner.displayName.trim()),
        curriculumMode,
        curriculumTitle,
        curriculumSummary,
        curriculumText,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(payload?.error ?? "Could not finish onboarding.");
      setSubmitting(false);
      return;
    }

    if (payload?.mode === "queued" && payload?.jobId) {
      try {
        const result = await waitForJob(payload.jobId);
        router.push(result?.output?.redirectTo ?? "/today");
      } catch (jobError) {
        setError(jobError instanceof Error ? jobError.message : "Curriculum generation failed.");
        setSubmitting(false);
        setJobStatus(null);
        return;
      }
    } else {
      router.push(payload?.redirectTo ?? "/today");
    }
    router.refresh();
    setJobStatus(null);
    setSubmitting(false);
  }

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
          <CardHeader>
            <CardTitle>Household setup</CardTitle>
            <CardDescription>
              Save the planning defaults that shape weekly generation and today&apos;s workload.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Household name
              <input
                value={householdName}
                onChange={(event) => setHouseholdName(event.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium">
                School year
                <input
                  value={schoolYearLabel}
                  onChange={(event) => setSchoolYearLabel(event.target.value)}
                  placeholder="2026-2027"
                  className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Term start
                <input
                  type="date"
                  value={termStartDate}
                  onChange={(event) => setTermStartDate(event.target.value)}
                  className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Term end
                <input
                  type="date"
                  value={termEndDate}
                  onChange={(event) => setTermEndDate(event.target.value)}
                  className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div className="grid gap-1.5 text-sm font-medium">
                Preferred school days
                <div className="flex flex-wrap gap-2">
                  {schoolDays.map((day) => {
                    const active = preferredSchoolDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleSchoolDay(day.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                Daily time budget
                <input
                  type="number"
                  min={30}
                  max={480}
                  step={15}
                  value={dailyTimeBudgetMinutes}
                  onChange={(event) => setDailyTimeBudgetMinutes(Number(event.target.value))}
                  className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-medium">
              Subjects
              <input
                value={subjects}
                onChange={(event) => setSubjects(event.target.value)}
                placeholder="Math, Language Arts, Science"
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Standards or state preference
                <input
                  value={standardsPreference}
                  onChange={(event) => setStandardsPreference(event.target.value)}
                  placeholder="Optional"
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
            </div>
          </CardContent>
        </Card>

        <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
            <CardDescription>
              One submission creates the first workable version of the household workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Save household defaults and pacing preferences.</p>
            <p>2. Create learner profiles with an initial workload bias.</p>
            <p>3. Create or import the first curriculum source.</p>
            <p>4. Build the first workable week.</p>
            <p>5. Open Today ready to adjust and run.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
        <CardHeader>
          <CardTitle>Learners</CardTitle>
          <CardDescription>Each learner gets a profile, a pace preference, and an initial workload setting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {learners.map((learner, index) => (
            <div key={index} className="grid gap-4 rounded-xl border border-border/60 bg-background/70 p-4 md:grid-cols-5">
              <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
                Name
                <input
                  value={learner.displayName}
                  onChange={(event) => updateLearner(index, { displayName: event.target.value })}
                  className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Grade
                <input
                  value={learner.gradeLevel}
                  onChange={(event) => updateLearner(index, { gradeLevel: event.target.value })}
                  placeholder="3rd grade"
                  className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Age range
                <input
                  value={learner.ageBand}
                  onChange={(event) => updateLearner(index, { ageBand: event.target.value })}
                  placeholder="8-9"
                  className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
              <div className="grid gap-2 md:col-span-5 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Pace
                  <select
                    value={learner.pacePreference}
                    onChange={(event) =>
                      updateLearner(index, {
                        pacePreference: event.target.value as LearnerDraft["pacePreference"],
                      })
                    }
                    className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                  >
                    <option value="gentle">Gentle</option>
                    <option value="balanced">Balanced</option>
                    <option value="accelerated">Accelerated</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Load
                  <select
                    value={learner.loadPreference}
                    onChange={(event) =>
                      updateLearner(index, {
                        loadPreference: event.target.value as LearnerDraft["loadPreference"],
                      })
                    }
                    className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
                  >
                    <option value="light">Light</option>
                    <option value="balanced">Balanced</option>
                    <option value="ambitious">Ambitious</option>
                  </select>
                </label>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setLearners((current) => [
                ...current,
                {
                  displayName: "",
                  gradeLevel: "",
                  ageBand: "",
                  pacePreference: "balanced",
                  loadPreference: "balanced",
                },
              ])
            }
          >
            Add learner
          </Button>
        </CardContent>
      </Card>

      <Card className="quiet-panel border-border/60 bg-card/78 shadow-none">
        <CardHeader>
          <CardTitle>Curriculum intake</CardTitle>
          <CardDescription>
            Start from a shell, paste a structured outline, or give the app source material to decompose.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Curriculum mode</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "manual_shell", label: "Starter shell" },
                { value: "paste_outline", label: "Paste outline" },
                { value: "ai_decompose", label: "AI decompose" },
              ].map((option) => {
                const active = curriculumMode === option.value;
                const inputId = `onboarding-curriculum-mode-${option.value}`;
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
              Curriculum title
              <input
                value={curriculumTitle}
                onChange={(event) => setCurriculumTitle(event.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Summary
              <input
                value={curriculumSummary}
                onChange={(event) => setCurriculumSummary(event.target.value)}
                placeholder="Optional parent-facing summary"
                className="rounded-xl border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
          </div>

          {curriculumMode !== "manual_shell" ? (
            <label className="grid gap-1.5 text-sm font-medium">
              {curriculumMode === "ai_decompose" ? "Source material" : "Structured outline"}
              <textarea
                value={curriculumText}
                onChange={(event) => setCurriculumText(event.target.value)}
                rows={10}
                placeholder={
                  curriculumMode === "ai_decompose"
                    ? "Paste a syllabus, table of contents, curriculum notes, or rough plan."
                    : "# Unit 1\n- Lesson 1\n- Lesson 2"
                }
                className="rounded-2xl border border-input bg-background px-3 py-3 font-normal"
              />
            </label>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {jobStatus ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{jobStatus}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Finishing setup..." : "Finish setup"}
        </Button>
      </div>
    </form>
  );
}
