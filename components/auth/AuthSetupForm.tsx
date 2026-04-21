"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeNextPath } from "@/lib/auth/next";

type AuthSetupFormProps = {
  defaultOrganizationName: string;
  email: string | null;
};

export function AuthSetupForm({ defaultOrganizationName, email }: AuthSetupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"), "/onboarding");
  const [organizationName, setOrganizationName] = React.useState(defaultOrganizationName);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not finish account setup.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not finish account setup.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card variant="glass" className="overflow-hidden">
      <CardHeader>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/76 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Home className="size-3.5" />
          Household setup
        </div>
        <CardTitle>Create household workspace</CardTitle>
        <CardDescription>
          Create the first household workspace tied to {email ?? "this account"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="organization-name" className="text-sm font-medium">
              Household name
            </label>
            <input
              id="organization-name"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              className="field-shell h-12 w-full rounded-2xl px-4 text-sm shadow-none"
              placeholder="Rivera Homeschool"
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          <Button type="submit" className="w-full rounded-2xl gap-2" disabled={submitting || !organizationName.trim()}>
            <Sparkles className="size-4" />
            {submitting ? "Creating workspace..." : "Create workspace"}
          </Button>
        </form>
        <div className="mt-5 border-t border-border/60 pt-4 text-xs leading-6 text-muted-foreground">
          This creates the household container first. Learners, schedule defaults, and curriculum setup continue immediately after.
        </div>
      </CardContent>
    </Card>
  );
}
