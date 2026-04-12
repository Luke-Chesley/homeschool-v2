"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthSetupFormProps = {
  defaultOrganizationName: string;
  email: string | null;
};

export function AuthSetupForm({ defaultOrganizationName, email }: AuthSetupFormProps) {
  const router = useRouter();
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

      router.replace("/onboarding");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not finish account setup.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="quiet-panel border-border/70 bg-card/88">
      <CardHeader>
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Rivera Homeschool"
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting || !organizationName.trim()}>
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
