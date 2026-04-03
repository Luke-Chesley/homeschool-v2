import { Card } from "@/components/ui/card";
import type { CurriculumSource, CurriculumTree as CurriculumTreeData } from "@/lib/curriculum/types";

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
          <div className="space-y-3 p-4 text-sm">
            <p className="font-medium text-foreground">{tree.source.title}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/70 px-3 py-2">
                <div className="text-xs text-muted-foreground">Nodes</div>
                <div className="mt-1 font-medium text-foreground">{tree.nodeCount}</div>
              </div>
              <div className="rounded-lg border border-border/70 px-3 py-2">
                <div className="text-xs text-muted-foreground">Skills</div>
                <div className="mt-1 font-medium text-foreground">{tree.skillCount}</div>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 px-3 py-2">
              <div className="text-xs text-muted-foreground">Import</div>
              <div className="mt-1 font-medium text-foreground">v{tree.source.importVersion}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="font-serif text-2xl">{tree.source.title}</h2>
            <p className="text-sm text-muted-foreground">
              Browse the structure that feeds planning.
            </p>
          </div>
          {tree.rootNodes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              This source has no normalized nodes yet.
            </p>
          ) : (
            <CurriculumTree tree={tree} />
          )}
        </div>
      </Card>
    </div>
  );
}
