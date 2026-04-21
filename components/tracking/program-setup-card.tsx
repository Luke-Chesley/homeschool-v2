"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { upsertTrackingComplianceProgramAction } from "@/app/(parent)/tracking/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RequirementProfile } from "@/lib/compliance/types";
import type { TrackingComplianceProgram } from "@/lib/tracking/types";

function fieldClassName() {
  return "field-shell min-w-0 h-11 w-full rounded-2xl px-4 text-sm shadow-none";
}

export function ProgramSetupCard(props: {
  program: TrackingComplianceProgram | null;
  profileOptions: RequirementProfile[];
}) {
  const router = useRouter();
  const [schoolYearLabel, setSchoolYearLabel] = React.useState(props.program?.schoolYearLabel ?? "");
  const [startDate, setStartDate] = React.useState(props.program?.startDate ?? "");
  const [endDate, setEndDate] = React.useState(props.program?.endDate ?? "");
  const [selectedProfileKey, setSelectedProfileKey] = React.useState(
    `${props.program?.jurisdictionCode ?? "US-GENERIC"}::${props.program?.pathwayCode ?? "independent_recordkeeping"}`,
  );
  const [gradeBand, setGradeBand] = React.useState<"elementary" | "secondary">(
    props.program?.gradeBand ?? "elementary",
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const selectedProfile =
    props.profileOptions.find(
      (profile) => `${profile.jurisdictionCode}::${profile.pathwayCode}` === selectedProfileKey,
    ) ?? props.profileOptions[0];

  async function saveProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfile) {
      setError("Choose a requirement profile first.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    const result = await upsertTrackingComplianceProgramAction({
      schoolYearLabel,
      startDate,
      endDate,
      jurisdictionCode: selectedProfile.jurisdictionCode,
      pathwayCode: selectedProfile.pathwayCode,
      gradeBand,
    });

    if (!result.ok) {
      setError(result.error ?? "Could not save the tracking setup.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setMessage("Tracking setup saved.");
    router.refresh();
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Tracking setup</CardTitle>
        <CardDescription>
          Choose the learner-year profile that drives attendance targets, deadlines, and report shells.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {props.program ? (
          <div className="rounded-xl border border-border/60 bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">
              {props.program.jurisdictionLabel} · {props.program.pathwayLabel}
            </p>
            <p className="mt-1">
              {props.program.schoolYearLabel} · {props.program.startDate} to {props.program.endDate}
            </p>
            <p className="mt-2">{props.program.framingNote}</p>
          </div>
        ) : null}

        <form className="grid min-w-0 gap-4 lg:grid-cols-2" onSubmit={saveProgram}>
          <div className="min-w-0 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="school-year-label">
              School year
            </label>
            <input
              id="school-year-label"
              value={schoolYearLabel}
              onChange={(event) => setSchoolYearLabel(event.target.value)}
              placeholder="2025-2026"
              className={fieldClassName()}
            />
          </div>

          <div className="min-w-0 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="profile-select">
              Jurisdiction profile
            </label>
            <select
              id="profile-select"
              value={selectedProfileKey}
              onChange={(event) => setSelectedProfileKey(event.target.value)}
              className={fieldClassName()}
            >
              {props.profileOptions.map((profile) => (
                <option
                  key={`${profile.jurisdictionCode}:${profile.pathwayCode}`}
                  value={`${profile.jurisdictionCode}::${profile.pathwayCode}`}
                >
                  {profile.jurisdictionLabel} · {profile.pathwayLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="start-date">
              Start date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={fieldClassName()}
            />
          </div>

          <div className="min-w-0 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="end-date">
              End date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={fieldClassName()}
            />
          </div>

          <div className="min-w-0 flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-sm font-medium text-foreground">Grade band</span>
            <div className="flex flex-wrap gap-2">
              {(["elementary", "secondary"] as const).map((option) => {
                const active = gradeBand === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGradeBand(option)}
                    className={`rounded-full border px-3.5 py-2 text-sm ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 bg-background/72 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option === "elementary" ? "Elementary" : "Secondary"}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedProfile ? (
            <div className="rounded-xl border border-border/60 bg-background/75 p-4 text-sm leading-6 text-muted-foreground lg:col-span-2">
              <p className="font-medium text-foreground">{selectedProfile.framingNote}</p>
              <p className="mt-2">
                Attendance mode: <span className="text-foreground">{selectedProfile.attendanceMode}</span>
              </p>
              <p>
                Required documents:{" "}
                <span className="text-foreground">
                  {selectedProfile.requiredDocuments.map((document) => document.label).join(", ")}
                </span>
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <Button type="submit" className="rounded-full" disabled={submitting}>
              {submitting ? "Saving setup..." : "Save tracking setup"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive lg:col-span-2">
              {error}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
