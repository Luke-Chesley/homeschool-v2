/**
 * Curriculum source detail page.
 *
 * Shows the full tree (units → lessons → objectives) for a single source
 * and provides a standards mapping panel.
 */

import * as React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurriculumTree } from "@/components/curriculum/CurriculumTree";
import { getCurriculumTree } from "@/lib/curriculum/service";

interface Props {
  params: Promise<{ sourceId: string }>;
}

export default async function CurriculumSourcePage({ params }: Props) {
  const { sourceId } = await params;
  const tree = await getCurriculumTree(sourceId);

  if (!tree) notFound();

  const { source } = tree;

  return (
    <div className="flex flex-col gap-8 px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/curriculum">
          <Button variant="ghost" size="icon" aria-label="Back to curriculum library">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {source.title}
          </h1>
          {source.description && (
            <p className="mt-1 text-sm text-muted-foreground">{source.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {source.academicYear && (
              <Badge variant="outline">{source.academicYear}</Badge>
            )}
            {source.subjects.map((s) => (
              <Badge key={s} variant="secondary" className="capitalize">
                {s}
              </Badge>
            ))}
            {source.gradeLevels.map((g) => (
              <Badge key={g} variant="outline">
                Grade {g}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Tree */}
        <div className="min-w-0 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-lg">Curriculum structure</h2>
            <Link href={`/curriculum/${sourceId}/units/new`}>
              <Button size="sm" variant="outline">
                Add unit
              </Button>
            </Link>
          </div>
          {tree.units.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 py-12 text-center">
              <p className="text-sm text-muted-foreground">No units yet.</p>
              <Link href={`/curriculum/${sourceId}/units/new`}>
                <Button size="sm" variant="outline" className="mt-3">
                  Add first unit
                </Button>
              </Link>
            </div>
          ) : (
            <CurriculumTree tree={tree} />
          )}
        </div>

        {/* Sidebar */}
        <div className="min-w-0 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Standards & Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Select a lesson or objective from the tree to view and edit its
                standards mappings.
              </p>
              <Link href={`/curriculum/${sourceId}/standards`}>
                <Button size="sm" variant="outline" className="mt-4 w-full">
                  Browse standards
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ingestion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Indexing status:{" "}
                <span className="font-medium capitalize">{source.indexingStatus.replace("_", " ")}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground/70">
                Integration point: trigger chunking/embedding job from here when
                the ingestion pipeline is ready.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
