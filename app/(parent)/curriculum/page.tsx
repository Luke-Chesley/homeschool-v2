/**
 * Curriculum library page — parent workspace.
 *
 * Shows all curriculum sources for the household and provides entry points
 * for adding new ones (manual, upload, AI draft).
 */

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurriculumSourceCard } from "@/components/curriculum/CurriculumSourceCard";
import { listCurriculumSources } from "@/lib/curriculum/service";

// Demo household ID — replaced by session lookup once auth is integrated
const DEMO_HOUSEHOLD_ID = "household-demo";

export const metadata = {
  title: "Curriculum Library",
};

export default async function CurriculumLibraryPage() {
  const sources = await listCurriculumSources(DEMO_HOUSEHOLD_ID);

  return (
    <div className="flex flex-col gap-8 px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Curriculum Library
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage your curriculum sources, units, and lesson objectives.
          </p>
        </div>
        <Link href="/curriculum/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Add curriculum
          </Button>
        </Link>
      </div>

      {/* Source list */}
      {sources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 py-16 text-center">
          <p className="text-muted-foreground text-sm">No curriculum added yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Get started by adding a curriculum source.
          </p>
          <Link href="/curriculum/new">
            <Button size="sm" variant="outline" className="mt-4">
              Add your first curriculum
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <Link
              key={source.id}
              href={`/curriculum/${source.id}`}
              className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <CurriculumSourceCard source={source} className="h-full" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
