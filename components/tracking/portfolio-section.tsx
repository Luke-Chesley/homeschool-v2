"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  savePortfolioEvidenceAction,
  uploadPortfolioArtifactAction,
} from "@/app/(parent)/tracking/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackingDashboard } from "@/lib/tracking/types";

function inputClassName() {
  return "field-shell h-11 rounded-2xl px-4 text-sm shadow-none";
}

export function PortfolioSection({ dashboard }: { dashboard: TrackingDashboard }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"saved" | "inbox" | "all">("saved");
  const [submittingEvidenceId, setSubmittingEvidenceId] = React.useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const visibleEvidence = dashboard.evidence.filter((item) => {
    if (filter === "all") {
      return true;
    }

    return item.portfolioStatus === filter;
  });

  async function updatePortfolioStatus(evidenceId: string, status: "saved" | "archived" | "inbox") {
    setSubmittingEvidenceId(evidenceId);
    const result = await savePortfolioEvidenceAction({ evidenceId, status });
    setSubmittingEvidenceId(null);

    if (!result.ok) {
      return;
    }

    router.refresh();
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadMessage(null);
    setUploadError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = await uploadPortfolioArtifactAction(formData);

    if (!result.ok) {
      setUploadError(result.error ?? "Could not add that portfolio item.");
      return;
    }

    setUploadMessage("Portfolio item saved.");
    form.reset();
    router.refresh();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)]">
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
          <CardDescription>
            Save work samples, uploads, evaluator letters, and notes into the learner-year bucket.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            <p>
              Saved items: <span className="font-medium text-foreground">{dashboard.portfolioSavedCount}</span>
            </p>
            <p>
              Inbox items waiting to be tagged:{" "}
              <span className="font-medium text-foreground">
                {dashboard.evidence.filter((item) => item.portfolioStatus === "inbox").length}
              </span>
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleUpload}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="portfolio-title">
                Title
              </label>
              <input id="portfolio-title" name="title" className={inputClassName()} placeholder="Fractions exit ticket" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="portfolio-kind">
                  Artifact kind
                </label>
                <select id="portfolio-kind" name="artifactKind" className={inputClassName()} defaultValue="work_sample">
                  <option value="work_sample">Work sample</option>
                  <option value="photo">Photo</option>
                  <option value="pdf">PDF</option>
                  <option value="test_result">Test result</option>
                  <option value="evaluator_letter">Evaluator letter</option>
                  <option value="report_card">Report card</option>
                  <option value="reading_log_export">Reading log export</option>
                  <option value="checklist_attachment">Checklist attachment</option>
                  <option value="note">Note only</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="portfolio-subject">
                  Subject
                </label>
                <input id="portfolio-subject" name="subjectKey" className={inputClassName()} placeholder="Math" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="portfolio-period">
                Period label
              </label>
              <input id="portfolio-period" name="periodLabel" className={inputClassName()} placeholder="Quarter 1" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="portfolio-note">
                Note
              </label>
              <textarea id="portfolio-note" name="note" rows={4} className="field-shell-textarea min-h-28 rounded-2xl px-4 py-3 text-sm shadow-none" placeholder="Why this belongs in the portfolio" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="portfolio-file">
                Optional file upload
              </label>
              <input id="portfolio-file" name="file" type="file" className="text-sm text-muted-foreground" />
            </div>

            <Button type="submit" className="rounded-full">Add to portfolio</Button>
            {uploadMessage ? <p className="text-sm text-muted-foreground">{uploadMessage}</p> : null}
            {uploadError ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{uploadError}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>Saved evidence</CardTitle>
          <CardDescription>
            Pull in existing evidence from Today or add manual uploads without re-entering the same facts later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["saved", "inbox", "all"] as const).map((option) => {
              const active = filter === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-full border px-3.5 py-2 text-sm ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option === "all" ? "All evidence" : option === "saved" ? "Saved" : "Inbox"}
                </button>
              );
            })}
          </div>

          {visibleEvidence.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-sm text-muted-foreground">
              No evidence matches this filter yet.
            </div>
          ) : (
            visibleEvidence.map((item) => (
              <div key={item.id} className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.capturedAt} · {item.kind} · {item.portfolioStatus}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.portfolioStatus !== "saved" ? (
                      <Button
                        size="sm"
                        onClick={() => updatePortfolioStatus(item.id, "saved")}
                        disabled={submittingEvidenceId === item.id}
                        className="rounded-full"
                      >
                        {submittingEvidenceId === item.id ? "Saving..." : "Save to portfolio"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updatePortfolioStatus(item.id, "archived")}
                        disabled={submittingEvidenceId === item.id}
                        className="rounded-full"
                      >
                        {submittingEvidenceId === item.id ? "Saving..." : "Archive"}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.note}</p>
                {item.portfolioArtifactKind ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Portfolio kind: {item.portfolioArtifactKind.replaceAll("_", " ")}
                    {item.portfolioSubjectKey ? ` · ${item.portfolioSubjectKey}` : ""}
                    {item.portfolioPeriodLabel ? ` · ${item.portfolioPeriodLabel}` : ""}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
