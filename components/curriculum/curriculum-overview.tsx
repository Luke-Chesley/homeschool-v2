import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurriculumSource, CurriculumTree as CurriculumTreeData } from "@/lib/curriculum/types";

import { CurriculumSourceSelector } from "./curriculum-source-selector";
import { CurriculumVisualizationPanel } from "./curriculum-visualization-panel";

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
            Visualize the normalized hierarchy as either an ordered flow map or the underlying tree
            from persisted <code>curriculum_nodes</code>.
          </p>
        </CardHeader>
        <CardContent>
          {tree.rootNodes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              This source has no normalized nodes yet.
            </p>
          ) : (
            <CurriculumVisualizationPanel tree={tree} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
