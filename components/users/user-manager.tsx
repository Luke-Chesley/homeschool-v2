"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UserManagerProps = {
  organization: {
    name: string;
  };
  learners: Array<{
    id: string;
    displayName: string;
    status: string;
  }>;
  activeLearnerId: string | null;
};

function describeLearnerAvailability(status: string) {
  switch (status) {
    case "paused":
      return "Paused";
    case "archived":
      return "Archived";
    default:
      return "Available in workspace";
  }
}

export function UserManager({
  organization,
  learners: initialLearners,
  activeLearnerId,
}: UserManagerProps) {
  const router = useRouter();
  const [learners, setLearners] = React.useState(initialLearners);
  const [selectedLearnerId, setSelectedLearnerId] = React.useState(activeLearnerId);
  const [displayName, setDisplayName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function selectLearner(learnerId: string) {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/app-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId }),
      });

      if (!response.ok) {
        throw new Error("Could not switch learners.");
      }

      setSelectedLearnerId(learnerId);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not switch learners.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createLearner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });

      if (!response.ok) {
        throw new Error("Could not create learner.");
      }

      const payload = (await response.json()) as {
        learner: { id: string; displayName: string; status: string };
      };

      setLearners((current) => [...current, payload.learner]);
      setSelectedLearnerId(payload.learner.id);
      setDisplayName("");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create learner.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="space-y-2">
          <p className="section-meta">Learners</p>
          <h1 className="page-title">Set the active learner, then keep moving.</h1>
          <p className="page-subtitle max-w-2xl">
            Choose the active learner, then keep moving. Add another learner when the household
            needs one.
          </p>
        </div>
      </header>

      <section className="quiet-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="section-meta">Active household</p>
          <p className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            {organization.name}
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Selecting a learner changes the active child inside this household. Today, Curriculum,
            Tracking, and Assistant all follow that selection.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="quiet-panel space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Learners in {organization.name}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Use a single active learner at a time so the rest of the workspace stays focused.
            </p>
          </div>
          <div className="grid gap-3">
            {learners.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                No learners yet. Create one to unlock the rest of the app.
              </div>
            ) : null}

            {learners.map((learner) => {
              const active = learner.id === selectedLearnerId;

              return (
                <button
                  key={learner.id}
                  type="button"
                  onClick={() => selectLearner(learner.id)}
                  disabled={submitting}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-4 text-left transition-colors",
                    active
                      ? "border-primary/20 bg-primary/8"
                      : "border-border/60 bg-background/70 hover:bg-card",
                    "disabled:cursor-not-allowed disabled:opacity-70",
                  )}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{learner.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {describeLearnerAvailability(learner.status)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {active ? (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Current learner
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full border",
                        active
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground",
                      )}
                    >
                      {active ? <Check className="size-4" /> : null}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="quiet-panel space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Add learner</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Start with a display name. Add another learner only when the household needs one.
            </p>
          </div>
          <form className="flex flex-col gap-4" onSubmit={createLearner}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="display-name" className="text-sm font-medium">
                Display name
              </label>
              <input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Maya"
                className="rounded-md border border-input bg-background/90 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" disabled={submitting || !displayName.trim()} className="gap-2 self-start">
              <Plus className="size-4" />
              Create learner
            </Button>
          </form>

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl border border-border/60 bg-background/72 px-4 py-3">
            <p className="text-sm font-medium text-foreground">What changes when you switch</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Today, learner activities, and Assistant context follow the active learner automatically.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
