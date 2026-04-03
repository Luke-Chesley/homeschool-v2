"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AddSourceModalContent } from "@/components/curriculum/AddSourceModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NewCurriculumClientPage({
  householdId,
  activeLearner,
}: {
  householdId: string;
  activeLearner: {
    displayName: string;
    firstName: string;
  };
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreated(data: {
    householdId: string;
    title?: string;
    description?: string;
    kind?: import("@/lib/curriculum/types").CurriculumSourceKind;
    subjects?: string[];
    gradeLevels?: string[];
    academicYear?: string;
    importPreset?: "local_curriculum_json";
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

  function handleCreatedSourceId(sourceId: string) {
    router.push(`/curriculum/${sourceId}`);
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
              householdId={householdId}
              activeLearner={activeLearner}
              onCreated={handleCreated}
              onCreatedSourceId={handleCreatedSourceId}
              onClose={() => router.back()}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
