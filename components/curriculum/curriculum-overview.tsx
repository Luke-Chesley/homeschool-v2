import Link from "next/link";
import { ArrowRight, Map, Sparkles, Waypoints } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
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
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <CurriculumSourceSelector
          sources={sources}
          activeSourceId={activeSourceId}
          onActivateSource={onActivateSource}
        />
        <MetricCard
          label="Curriculum nodes"
          value={tree.nodeCount}
          hint={`${tree.skillCount} teachable skills are available in the live tree.`}
          icon={Waypoints}
        />
        <MetricCard
          label="Import version"
          value={`v${tree.source.importVersion}`}
          hint="Use this to confirm you are looking at the latest normalized source."
          icon={Sparkles}
          tone="secondary"
        />
      </div>

      <div className="grid gap-6">
        <Card className="reading-surface">
          <div className="space-y-5 p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
              <div className="space-y-3">
                <div className="toolbar-row">
                  <span className="rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    Live source
                  </span>
                </div>
                <div>
                  <h2 className="font-serif text-[2rem] leading-tight tracking-[-0.03em] text-foreground">
                    {tree.source.title}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Browse the source structure here, then open the curriculum roadmap when you want the teaching
                    sequence, work chunks, and pacing context in one place.
                  </p>
                </div>
              </div>

              <div className="context-rail space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Curriculum roadmap</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Open the roadmap when you want the teaching journey first, the structure second, and dependencies on drill-in.
                  </p>
                </div>
                <Link
                  href={`/curriculum/graph?sourceId=${activeSourceId}`}
                  className={cn(buttonVariants({ size: "sm" }), "w-full justify-center lg:w-auto")}
                >
                  <Map className="size-4" />
                  Open roadmap
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {tree.rootNodes.length === 0 ? (
              <p className="empty-state-panel text-sm text-muted-foreground">
                This source has no normalized nodes yet.
              </p>
            ) : (
              <CurriculumTree tree={tree} />
            )}
          </div>
        </Card>

        <CurriculumRefinementWidget sourceId={activeSourceId} sourceTitle={tree.source.title} />
      </div>

    </div>
  );
}
