"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { saveComplianceReportDraftAction } from "@/app/(parent)/tracking/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackingDashboard } from "@/lib/tracking/types";
import { cn } from "@/lib/utils";

function textareaClassName() {
  return "min-h-48 rounded-md border border-input bg-background/90 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
}

export function ReportsView({ dashboard }: { dashboard: TrackingDashboard }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const openTaskCount = dashboard.complianceTasks.filter(
    (task) => task.status !== "completed" && task.status !== "not_applicable",
  ).length;

  async function saveDraft(formData: FormData) {
    const id = String(formData.get("id") ?? "");
    const reportKind = formData.get("reportKind");
    const periodLabel = formData.get("periodLabel");
    const title = formData.get("title");
    const content = formData.get("content");

    if (
      reportKind !== "attendance_summary" &&
      reportKind !== "quarterly_report" &&
      reportKind !== "annual_summary" &&
      reportKind !== "evaluation_packet" &&
      reportKind !== "portfolio_checklist" &&
      reportKind !== "transcript_skeleton"
    ) {
      setError("Unknown report draft kind.");
      return;
    }

    setPendingId(id);
    setMessage(null);
    setError(null);

    const result = await saveComplianceReportDraftAction({
      reportKind,
      periodLabel: typeof periodLabel === "string" ? periodLabel : "",
      title: typeof title === "string" ? title : "",
      content: typeof content === "string" ? content : "",
      status: "draft",
    });

    setPendingId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not save that draft.");
      return;
    }

    setMessage("Draft saved.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardTitle>Report drafts</CardTitle>
            <CardDescription>
              These drafts stay editable and exportable. The app helps assemble the packet but does not file anything for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              {dashboard.program
                ? `${dashboard.program.jurisdictionLabel} · ${dashboard.program.pathwayLabel}`
                : "Generic record pack"}
            </p>
            <p>
              Attendance: {dashboard.attendance.summary.progressLabel} · {dashboard.attendance.summary.readinessLabel}
            </p>
            <p>
              Saved portfolio items: {dashboard.portfolioSavedCount} · Open tasks:{" "}
              {openTaskCount}
            </p>
          </CardContent>
        </Card>

        <Card className="quiet-panel shadow-none">
          <CardHeader>
            <CardTitle>Exports</CardTitle>
            <CardDescription>Download summary views and packet shells directly from this record set.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dashboard.reportDrafts.map((draft) => (
              <a
                key={`export-${draft.id}`}
                href={`/api/homeschool/reports/export?kind=${draft.reportKind}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-start")}
              >
                Export {draft.title.toLowerCase()}
              </a>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6">
        {dashboard.reportDrafts.map((draft) => (
          <Card key={draft.id} className="quiet-panel shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{draft.title}</CardTitle>
                  <CardDescription>
                    {draft.periodLabel} · {draft.status}
                  </CardDescription>
                </div>
                <a
                  href={`/api/homeschool/reports/export?kind=${draft.reportKind}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Export draft
                </a>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await saveDraft(new FormData(event.currentTarget));
                }}
              >
                <input type="hidden" name="id" value={draft.id} />
                <input type="hidden" name="reportKind" value={draft.reportKind} />
                <input type="hidden" name="periodLabel" value={draft.periodLabel} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor={`title-${draft.id}`}>
                    Title
                  </label>
                  <input
                    id={`title-${draft.id}`}
                    name="title"
                    defaultValue={draft.title}
                    className="rounded-md border border-input bg-background/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor={`content-${draft.id}`}>
                    Draft content
                  </label>
                  <textarea
                    id={`content-${draft.id}`}
                    name="content"
                    defaultValue={draft.content}
                    className={textareaClassName()}
                  />
                </div>
                <Button type="submit" disabled={pendingId === draft.id}>
                  {pendingId === draft.id ? "Saving draft..." : "Save draft"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </section>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
