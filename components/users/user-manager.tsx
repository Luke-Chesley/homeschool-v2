"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type UserManagerProps = {
  organization: {
    id: string;
    name: string;
  };
  learners: Array<{
    id: string;
    displayName: string;
    status: string;
  }>;
  activeLearnerId: string | null;
};

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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Users</p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Manage learners</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Keep users lightweight for now. Each learner is distinct, selectable, and becomes the
          active context for curriculum, learner activity, and copilot work.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{organization.name}</CardTitle>
            <CardDescription>Select who the app is currently acting on.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {learners.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
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
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-left transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div>
                    <p className="font-medium">{learner.displayName}</p>
                    <p className="text-xs capitalize text-muted-foreground">{learner.status}</p>
                  </div>
                  <span
                    className={`inline-flex size-8 items-center justify-center rounded-full border ${
                      active
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-border/70 text-muted-foreground"
                    }`}
                  >
                    {active ? <Check className="size-4" /> : null}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add learner</CardTitle>
            <CardDescription>Minimal by design. Name first, details later.</CardDescription>
          </CardHeader>
          <CardContent>
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
                  className="rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button type="submit" disabled={submitting || !displayName.trim()} className="gap-2">
                <Plus className="size-4" />
                Create learner
              </Button>
            </form>

            {error ? (
              <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
