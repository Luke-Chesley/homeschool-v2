import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurriculumSource, CurriculumTree as CurriculumTreeData } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

import { CurriculumSourceSelector } from "./curriculum-source-selector";
import { CurriculumTree } from "./curriculum-tree";

interface CurriculumOverviewProps {
  sources: CurriculumSource[];
  selectedSourceId: string;
  tree: CurriculumTreeData;
}

export function CurriculumOverview({ sources, selectedSourceId, tree }: CurriculumOverviewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <CurriculumSourceSelector sources={sources} selectedSourceId={selectedSourceId} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <span className="text-muted-foreground">Nodes</span>
              <span className="font-semibold">{tree.nodeCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <span className="text-muted-foreground">Skills</span>
              <span className="font-semibold">{tree.skillCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <span className="text-muted-foreground">Import version</span>
              <span className="font-semibold">v{tree.source.importVersion}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="capitalize">
                {tree.source.kind.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {tree.source.status.replace("_", " ")}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{tree.source.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Canonical normalized hierarchy from persisted <code>curriculum_nodes</code>, with a
            dedicated graph workspace available for visual flow.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Graph workspace</p>
                <p className="text-sm text-muted-foreground">
                  Open the dedicated graph view to inspect connected nodes, hierarchy, and branch
                  flow in a visual canvas.
                </p>
              </div>
              <Link
                href={`/curriculum/graph?sourceId=${selectedSourceId}`}
                className={cn(buttonVariants({ size: "sm" }), "w-full justify-center lg:w-auto")}
              >
                Open graph view
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {tree.rootNodes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              This source has no normalized nodes yet.
            </p>
          ) : (
            <CurriculumTree tree={tree} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
