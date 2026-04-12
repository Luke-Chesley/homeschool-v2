"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HomeschoolAttendanceRecord, HomeschoolAttendanceStatus } from "@/lib/homeschool/attendance/types";

const attendanceOptions: Array<{ value: HomeschoolAttendanceStatus; label: string }> = [
  { value: "present", label: "Present" },
  { value: "partial", label: "Partial" },
  { value: "absent", label: "Absent" },
  { value: "field_trip", label: "Field trip" },
  { value: "holiday", label: "Holiday" },
];

export function AttendanceCard(props: {
  todayDate: string;
  records: HomeschoolAttendanceRecord[];
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = React.useState<HomeschoolAttendanceStatus>("present");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function saveAttendance(status: HomeschoolAttendanceStatus) {
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/homeschool/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: props.todayDate,
        status,
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
  }

  return (
    <Card className="quiet-panel shadow-none">
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>
          Mark today quickly, then keep the recent log visible for records and exports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {attendanceOptions.map((option) => {
            const active = selectedStatus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedStatus(option.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <Button onClick={() => saveAttendance(selectedStatus)} disabled={submitting}>
          {submitting ? "Saving attendance..." : `Mark ${selectedStatus.replace("_", " ")}`}
        </Button>

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="space-y-2">
          {props.records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            props.records.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm"
              >
                <span>{record.date}</span>
                <span className="capitalize text-muted-foreground">
                  {record.status.replace("_", " ")}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
