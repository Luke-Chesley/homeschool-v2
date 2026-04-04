"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DatabaseZap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CurriculumEmptyStateProps {
  householdId: string;
}

export function CurriculumEmptyState({ householdId }: CurriculumEmptyStateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleImportLocalSample = () => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/curriculum/sources", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            householdId,
            importPreset: "local_curriculum_json",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to import local curriculum sample.");
        }

        const source = (await response.json()) as { id: string };
        router.push(`/curriculum/${source.id}`);
        router.refresh();
      } catch (importError) {
        console.error(importError);
        setError("Could not import the local sample right now. Please try again.");
      }
    });
  };

  return (
    <Card className="border-dashed border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-2xl">No curriculum source yet</CardTitle>
        <CardDescription>
          Import the local sample to bootstrap the first real curriculum tree for planning.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          onClick={handleImportLocalSample}
          disabled={isPending}
          className="gap-2"
        >
          <DatabaseZap className="size-4" />
          {isPending ? "Importing local sample..." : "Import local sample curriculum"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
