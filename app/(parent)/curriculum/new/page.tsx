"use client";

/**
 * New curriculum source page.
 *
 * Presents the three entry points (manual, upload, AI draft) and handles
 * creation through the curriculum service.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddSourceModalContent } from "@/components/curriculum/AddSourceModal";

const DEMO_HOUSEHOLD_ID = "household-demo";

export default function NewCurriculumPage() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreated(data: {
    title: string;
    description: string;
    kind: import("@/lib/curriculum/types").CurriculumSourceKind;
    subjects: string[];
    gradeLevels: string[];
    householdId: string;
  }) {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/curriculum/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create curriculum source.");
      const created = await res.json();
      router.push(`/curriculum/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 px-6 py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/curriculum">
          <Button variant="ghost" size="icon" aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Add Curriculum
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose an entry point</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {creating ? (
            <p className="text-sm text-muted-foreground">Creating curriculum…</p>
          ) : (
            <AddSourceModalContent
              householdId={DEMO_HOUSEHOLD_ID}
              onCreated={handleCreated}
              onClose={() => router.back()}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
