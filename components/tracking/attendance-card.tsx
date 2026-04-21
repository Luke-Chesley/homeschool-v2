"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceLedgerEntry, AttendanceProgressSummary } from "@/lib/compliance/types";

const attendanceOptions = [
  { value: "present", label: "Present" },
  { value: "partial", label: "Partial" },
  { value: "excused", label: "Excused" },
  { value: "non_instructional", label: "Non-instructional" },
] as const;

function inputClassName() {
  return "field-shell h-11 rounded-2xl px-4 text-sm shadow-none";
}

export function AttendanceCard(props: {
  todayDate: string;
  complianceProgramId: string | null;
  summary: AttendanceProgressSummary;
  records: AttendanceLedgerEntry[];
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = React.useState<(typeof attendanceOptions)[number]["value"]>("present");
  const [minutes, setMinutes] = React.useState("240");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function saveAttendance() {
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/homeschool/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: props.todayDate,
        complianceProgramId: props.complianceProgramId ?? undefined,
        status: selectedStatus,
        minutes: selectedStatus === "present" || selectedStatus === "partial" ? Number(minutes) || 0 : 0,
        note: note.trim() || undefined,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Could not save attendance.");
      setSubmitting(false);
      return;
    }

    router.refresh();
    setSubmitting(false);
    setNote("");
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>
          Keep one daily ledger for days, hours, and explicit non-instructional days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{props.summary.progressLabel}</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
            <p className="text-xs text-muted-foreground">Readiness</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{props.summary.readinessLabel}</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
            <p className="text-xs text-muted-foreground">Non-instructional days</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{props.summary.nonInstructionalDays}</p>
          </div>
        </div>

        <div className="grid gap-4 rounded-[1.5rem] border border-border/60 bg-background/75 p-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {attendanceOptions.map((option) => {
                const active = selectedStatus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedStatus(option.value)}
                    className={`rounded-full border px-3.5 py-2 text-sm ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="attendance-minutes">
                  Instructional minutes
                </label>
                <input
                  id="attendance-minutes"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  disabled={selectedStatus === "non_instructional" || selectedStatus === "excused"}
                  className={inputClassName()}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="attendance-note">
                  Note
                </label>
                <input
                  id="attendance-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional context"
                  className={inputClassName()}
                />
              </div>
            </div>

            <Button className="rounded-full" onClick={saveAttendance} disabled={submitting || !props.complianceProgramId}>
              {submitting ? "Saving attendance..." : "Save today"}
            </Button>
            {!props.complianceProgramId ? (
              <p className="text-sm text-muted-foreground">
                Save the tracking setup first so attendance is tied to the right learner-year profile.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            {props.records.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records yet.</p>
            ) : (
              props.records.slice(0, 21).map((record) => (
                <div
                  key={record.id}
                  className="rounded-[1.2rem] border border-border/60 bg-background px-3 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{record.date}</span>
                    <span className="capitalize text-muted-foreground">
                      {record.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {record.instructionalMinutes} minutes · {record.source.replaceAll("_", " ")}
                    {record.isSuggested ? " suggestion" : ""}
                  </p>
                  {record.note ? <p className="mt-2 text-sm text-muted-foreground">{record.note}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
