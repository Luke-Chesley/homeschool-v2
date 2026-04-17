import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CurriculumSource, CurriculumTree as CurriculumTreeData } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

import { CurriculumSourceSelector } from "./curriculum-source-selector";
import { CurriculumRefinementWidget } from "./CurriculumRefinementWidget";
import { CurriculumTree } from "./curriculum-tree";

interface CurriculumOverviewProps {
  sources: CurriculumSource[];
  activeSourceId: string;
  onActivateSource: (formData: FormData) => Promise<void>;
  tree: CurriculumTreeData;
}

export function CurriculumOverview({
  sources,
  activeSourceId,
  onActivateSource,
  tree,
}: CurriculumOverviewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-4">
        <CurriculumSourceSelector
          sources={sources}
          activeSourceId={activeSourceId}
          onActivateSource={onActivateSource}
        />
        <Card className="quiet-panel">
          <div className="space-y-3 p-4 text-sm">
            <p className="font-medium text-foreground">{tree.source.title}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                <div className="text-xs text-muted-foreground">Nodes</div>
                <div className="mt-1 font-medium text-foreground">{tree.nodeCount}</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                <div className="text-xs text-muted-foreground">Skills</div>
                <div className="mt-1 font-medium text-foreground">{tree.skillCount}</div>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
              <div className="text-xs text-muted-foreground">Import</div>
              <div className="mt-1 font-medium text-foreground">v{tree.source.importVersion}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="reading-surface">
        <div className="space-y-4 p-5">
          <div className="space-y-3">
            <div>
              <h2 className="font-serif text-2xl">{tree.source.title}</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Browse the structure here, then open the visual map when you want to inspect
                branch relationships more closely.
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Visual map</p>
                  <p className="text-sm text-muted-foreground">
                    Open the visual map to inspect connected nodes, hierarchy, and branch flow in
                    one place.
                  </p>
                </div>
                <Link
                  href={`/curriculum/graph?sourceId=${activeSourceId}`}
                  className={cn(buttonVariants({ size: "sm" }), "w-full justify-center lg:w-auto")}
                >
                  Open visual map
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
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

      <CurriculumRefinementWidget sourceId={activeSourceId} sourceTitle={tree.source.title} />
    </div>
  );
}
