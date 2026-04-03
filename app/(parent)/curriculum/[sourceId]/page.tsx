import * as React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurriculumTree } from "@/components/curriculum/CurriculumTree";
import { requireAppSession } from "@/lib/app-session/server";
import { getCurriculumTree, listCurriculumOutline } from "@/lib/curriculum/service";

interface Props {
  params: Promise<{ sourceId: string }>;
}

export default async function CurriculumSourcePage({ params }: Props) {
  const session = await requireAppSession();
  const { sourceId } = await params;
  const tree = await getCurriculumTree(sourceId, session.organization.id);

  if (!tree) notFound();

  const { source } = tree;
  const outline = await listCurriculumOutline(sourceId);
  const lessonCount = outline.reduce((total, unit) => total + unit.lessons.length, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
      <div className="flex items-start gap-3">
        <Link href="/curriculum">
          <Button variant="ghost" size="icon" aria-label="Back to curriculum library">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{source.title}</h1>
          {source.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{source.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">
              {source.kind.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {source.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline">Import v{source.importVersion}</Badge>
            {source.academicYear ? <Badge variant="outline">{source.academicYear}</Badge> : null}
            {source.subjects.map((subject) => (
              <Badge key={subject} variant="secondary" className="capitalize">
                {subject}
              </Badge>
            ))}
            {source.gradeLevels.map((grade) => (
              <Badge key={grade} variant="outline">
                Grade {grade}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Canonical curriculum nodes</h2>
              <p className="text-sm text-muted-foreground">
                Persisted `curriculum_nodes` define the planning hierarchy and canonical sequence.
              </p>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{tree.nodeCount} nodes</span>
              <span>{tree.skillCount} skills</span>
              <span>{outline.length} units</span>
              <span>{lessonCount} lessons</span>
            </div>
          </div>
          {tree.rootNodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {source.kind === "ai_draft"
                  ? "This AI draft saved the planning brief, but it has not been expanded into normalized curriculum nodes yet."
                  : "No normalized curriculum nodes yet."}
              </p>
            </div>
          ) : (
            <CurriculumTree tree={tree} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Node Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Node IDs are deterministic from source lineage plus normalized path.</p>
              <p>Parent-child links come from `parentNodeId`.</p>
              <p>Sibling order comes from `sequenceIndex`, not weekly or daily overrides.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Standards & Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Standards mapping still hangs off the curriculum source, but this detail tree now reads
                from persisted normalized nodes.
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
              <CardTitle className="text-base">Teaching Outline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {outline.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No units or lessons have been generated for this curriculum yet.
                </p>
              ) : (
                outline.slice(0, 4).map((unit) => (
                  <div key={unit.id} className="rounded-xl border border-border/70 px-3 py-3">
                    <p className="text-sm font-medium">{unit.title}</p>
                    {unit.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{unit.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {unit.lessons.length} lessons
                      {typeof unit.estimatedWeeks === "number"
                        ? ` · ${unit.estimatedWeeks} week${unit.estimatedWeeks === 1 ? "" : "s"}`
                        : ""}
                    </p>
                    <div className="mt-2 space-y-1">
                      {unit.lessons.slice(0, 3).map((lesson) => (
                        <p key={lesson.id} className="text-xs text-muted-foreground">
                          {lesson.title}
                        </p>
                      ))}
                      {unit.lessons.length > 3 ? (
                        <p className="text-xs text-muted-foreground">
                          +{unit.lessons.length - 3} more lessons
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
