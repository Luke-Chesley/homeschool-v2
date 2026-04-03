import { ArrowRight, BookOpenText, FolderTree, Layers3, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CurriculumTree as CurriculumTreeData, CurriculumTreeNode } from "@/lib/curriculum/types";

interface CurriculumFlowMapProps {
  tree: CurriculumTreeData;
}

const typeIcon = {
  domain: FolderTree,
  strand: Layers3,
  goal_group: BookOpenText,
  skill: Target,
} as const;

const typeLabel = {
  domain: "Domain",
  strand: "Strand",
  goal_group: "Goal Group",
  skill: "Skill",
} as const;

const typeSurface = {
  domain: "border-l-4 border-l-primary/60 bg-primary/5",
  strand: "border-l-4 border-l-sky-500/50 bg-sky-500/5",
  goal_group: "border-l-4 border-l-amber-500/50 bg-amber-500/5",
  skill: "border-l-4 border-l-emerald-500/50 bg-emerald-500/5",
} as const;

const orderedLevels: Array<keyof typeof typeLabel> = ["domain", "strand", "goal_group", "skill"];

function countSkills(node: CurriculumTreeNode): number {
  if (node.normalizedType === "skill") {
    return 1;
  }

  return node.children.reduce((total, child) => total + countSkills(child), 0);
}

function countDescendants(node: CurriculumTreeNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function FlowNodeCard({ node }: { node: CurriculumTreeNode }) {
  const Icon = typeIcon[node.normalizedType];
  const descendants = countDescendants(node);
  const skillCount = countSkills(node);

  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-border/70 px-4 py-4 shadow-sm",
        typeSurface[node.normalizedType],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Step {node.sequenceIndex + 1}
          </p>
          <h4 className="mt-1 text-sm font-semibold leading-6 text-foreground">{node.title}</h4>
        </div>
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-[0.14em]">
          {typeLabel[node.normalizedType]}
        </Badge>
        {node.code ? (
          <Badge variant="secondary" className="text-[10px]">
            {node.code}
          </Badge>
        ) : null}
        {node.children.length > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {node.children.length} next
          </Badge>
        ) : null}
        {node.normalizedType !== "skill" && skillCount > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {skillCount} skills
          </Badge>
        ) : null}
        {descendants > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {descendants} descendants
          </Badge>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        {node.description?.trim() || node.normalizedPath}
      </p>
    </div>
  );
}

function FlowBranch({ node, depth }: { node: CurriculumTreeNode; depth: number }) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FlowNodeCard node={node} />
      {hasChildren ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-2 pl-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>Next</span>
            <ArrowRight className="size-3" />
            <span>{typeLabel[node.children[0].normalizedType]}</span>
          </div>
          <div
            className={cn(
              "grid gap-3 border-l border-dashed border-border/80 pl-4",
              depth === 0 && "xl:grid-cols-2",
              depth >= 1 && "2xl:grid-cols-2",
            )}
          >
            {node.children.map((child) => (
              <FlowBranch key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CurriculumFlowMap({ tree }: CurriculumFlowMapProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Ordered curriculum flow</p>
            <p className="text-sm text-muted-foreground">
              Read left-to-right within each branch and top-to-bottom across nested levels. The map
              keeps the canonical sequence while surfacing the hierarchy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {orderedLevels.map((level) => (
              <Badge key={level} variant="outline" className="gap-1 text-[10px] uppercase tracking-[0.16em]">
                {typeLabel[level]}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {tree.rootNodes.map((node) => (
          <section
            key={node.id}
            className="rounded-3xl border border-border/70 bg-card/60 p-4 shadow-[var(--shadow-card)]"
          >
            <FlowBranch node={node} depth={0} />
          </section>
        ))}
      </div>
    </div>
  );
}
