"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenText, FolderTree, Layers3, Network, RotateCcw, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  CurriculumSource,
  CurriculumTree as CurriculumTreeData,
  CurriculumTreeNode,
  CurriculumNodeType,
} from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

interface CurriculumGraphWorkspaceProps {
  sources: CurriculumSource[];
  selectedSourceId: string;
  tree: CurriculumTreeData;
}

interface GraphNodePosition {
  node: CurriculumTreeNode;
  depth: number;
  left: number;
  top: number;
}

interface GraphEdgePosition {
  fromId: string;
  toId: string;
  path: string;
}

interface GraphLayout {
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
  nodes: GraphNodePosition[];
  edges: GraphEdgePosition[];
  levels: CurriculumNodeType[];
}

const GRAPH_WIDTH = 1320;
const GRAPH_PADDING_X = 42;
const GRAPH_PADDING_Y = 34;
const GRAPH_COLUMN_GAP = 52;
const GRAPH_NODE_HEIGHT = 118;
const GRAPH_ROW_GAP = 20;
const MIN_GRAPH_HEIGHT = 620;

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

const nodeSurface = {
  domain: "border-amber-400/65 bg-amber-50/85 dark:bg-amber-950/25",
  strand: "border-sky-400/65 bg-sky-50/85 dark:bg-sky-950/25",
  goal_group: "border-emerald-400/65 bg-emerald-50/85 dark:bg-emerald-950/25",
  skill: "border-rose-400/65 bg-rose-50/85 dark:bg-rose-950/25",
} as const;

function sortNodes(nodes: CurriculumTreeNode[]) {
  return [...nodes].sort((left, right) => {
    if (left.sequenceIndex !== right.sequenceIndex) {
      return left.sequenceIndex - right.sequenceIndex;
    }

    return left.title.localeCompare(right.title);
  });
}

function countSkills(node: CurriculumTreeNode): number {
  if (node.normalizedType === "skill") {
    return 1;
  }

  return node.children.reduce((total, child) => total + countSkills(child), 0);
}

function indexSubtree(root: CurriculumTreeNode) {
  const nodeMap = new Map<string, CurriculumTreeNode>();
  const parentMap = new Map<string, string | null>();

  const visit = (node: CurriculumTreeNode, parentId: string | null) => {
    nodeMap.set(node.id, node);
    parentMap.set(node.id, parentId);

    for (const child of node.children) {
      visit(child, node.id);
    }
  };

  visit(root, null);

  return { nodeMap, parentMap };
}

function collectDescendantIds(node: CurriculumTreeNode, acc = new Set<string>()) {
  acc.add(node.id);

  for (const child of node.children) {
    collectDescendantIds(child, acc);
  }

  return acc;
}

function getAncestorIds(nodeId: string, parentMap: Map<string, string | null>) {
  const ancestorIds = new Set<string>();
  let currentId: string | null | undefined = nodeId;

  while (currentId) {
    ancestorIds.add(currentId);
    currentId = parentMap.get(currentId) ?? null;
  }

  return ancestorIds;
}

function buildEdgePath(parent: GraphNodePosition, child: GraphNodePosition, nodeWidth: number, nodeHeight: number) {
  const startX = parent.left + nodeWidth;
  const startY = parent.top + nodeHeight / 2;
  const endX = child.left;
  const endY = child.top + nodeHeight / 2;
  const controlOffset = Math.max((endX - startX) * 0.42, 36);

  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
}

function buildGraphLayout(root: CurriculumTreeNode): GraphLayout {
  const nodesByDepth = new Map<number, CurriculumTreeNode[]>();
  const levels = new Set<CurriculumNodeType>();
  let maxDepth = 0;

  const visit = (node: CurriculumTreeNode, depth: number) => {
    levels.add(node.normalizedType);
    maxDepth = Math.max(maxDepth, depth);

    const column = nodesByDepth.get(depth);
    if (column) {
      column.push(node);
    } else {
      nodesByDepth.set(depth, [node]);
    }

    for (const child of sortNodes(node.children)) {
      visit(child, depth + 1);
    }
  };

  visit(root, 0);

  const columnCount = maxDepth + 1;
  const nodeWidth =
    (GRAPH_WIDTH - GRAPH_PADDING_X * 2 - Math.max(columnCount - 1, 0) * GRAPH_COLUMN_GAP) /
    columnCount;

  const nodes: GraphNodePosition[] = [];
  const positionById = new Map<string, GraphNodePosition>();

  for (const [depth, columnNodes] of [...nodesByDepth.entries()].sort((left, right) => left[0] - right[0])) {
    columnNodes.forEach((node, index) => {
      const position: GraphNodePosition = {
        node,
        depth,
        left: GRAPH_PADDING_X + depth * (nodeWidth + GRAPH_COLUMN_GAP),
        top: GRAPH_PADDING_Y + index * (GRAPH_NODE_HEIGHT + GRAPH_ROW_GAP),
      };

      nodes.push(position);
      positionById.set(node.id, position);
    });
  }

  const edges: GraphEdgePosition[] = [];

  for (const position of nodes) {
    for (const child of sortNodes(position.node.children)) {
      const childPosition = positionById.get(child.id);

      if (!childPosition) {
        continue;
      }

      edges.push({
        fromId: position.node.id,
        toId: child.id,
        path: buildEdgePath(position, childPosition, nodeWidth, GRAPH_NODE_HEIGHT),
      });
    }
  }

  const tallestColumn = Math.max(...[...nodesByDepth.values()].map((column) => column.length), 1);
  const height =
    GRAPH_PADDING_Y * 2 +
    tallestColumn * GRAPH_NODE_HEIGHT +
    Math.max(tallestColumn - 1, 0) * GRAPH_ROW_GAP;

  return {
    width: GRAPH_WIDTH,
    height: Math.max(height, MIN_GRAPH_HEIGHT),
    nodeWidth,
    nodeHeight: GRAPH_NODE_HEIGHT,
    nodes,
    edges,
    levels: Array.from(levels),
  };
}

function SourceBar({
  sources,
  selectedSourceId,
}: {
  sources: CurriculumSource[];
  selectedSourceId: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => {
        const selected = source.id === selectedSourceId;
        const href = `/curriculum/graph?sourceId=${source.id}`;

        return (
          <Link
            key={source.id}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              selected
                ? "border-primary/40 bg-primary/10 text-foreground shadow-[var(--shadow-active)]"
                : "border-border/70 bg-background/75 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <span className="font-medium">{source.title}</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.14em]">
              v{source.importVersion}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

export function CurriculumGraphWorkspace({
  sources,
  selectedSourceId,
  tree,
}: CurriculumGraphWorkspaceProps) {
  const rootDomains = sortNodes(tree.rootNodes);
  const [activeDomainId, setActiveDomainId] = useState(rootDomains[0]?.id ?? "");
  const [graphRootId, setGraphRootId] = useState(rootDomains[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState(rootDomains[0]?.id ?? "");

  useEffect(() => {
    const firstDomain = sortNodes(tree.rootNodes)[0];
    const nextId = firstDomain?.id ?? "";
    setActiveDomainId(nextId);
    setGraphRootId(nextId);
    setSelectedNodeId(nextId);
  }, [tree.source.id, tree.rootNodes]);

  const activeDomain = rootDomains.find((domain) => domain.id === activeDomainId) ?? rootDomains[0] ?? null;

  if (!activeDomain) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-sm text-muted-foreground">
            This source has no root domains to graph yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeDomainIndex = indexSubtree(activeDomain);
  const graphRoot = activeDomainIndex.nodeMap.get(graphRootId) ?? activeDomain;
  const graphIndex = indexSubtree(graphRoot);
  const selectedNode = graphIndex.nodeMap.get(selectedNodeId) ?? graphRoot;
  const selectedAncestors = getAncestorIds(selectedNode.id, graphIndex.parentMap);
  const selectedDescendants = collectDescendantIds(selectedNode);
  const highlightedIds = new Set([...selectedAncestors, ...selectedDescendants]);
  const graphLayout = buildGraphLayout(graphRoot);

  const handleDomainChange = (domainId: string) => {
    setActiveDomainId(domainId);
    setGraphRootId(domainId);
    setSelectedNodeId(domainId);
  };

  const handleNodeClick = (node: CurriculumTreeNode) => {
    setSelectedNodeId(node.id);

    if (node.children.length > 0 && node.id !== graphRoot.id) {
      setGraphRootId(node.id);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(234,179,8,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.1),_transparent_28%),var(--color-card)]">
        <CardContent className="space-y-6 p-6 sm:p-7">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Curriculum source
                </p>
                <SourceBar sources={sources} selectedSourceId={selectedSourceId} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{tree.nodeCount} nodes</Badge>
                <Badge variant="outline">{tree.skillCount} skills</Badge>
                <Badge variant="outline" className="capitalize">
                  {tree.source.kind.replace("_", " ")}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Network className="size-4 text-primary" />
                  Logical curriculum graph
                </div>
                <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
                  Choose a domain, then click nodes to move deeper into that branch. The graph uses
                  the full workspace width so the structure reads as one connected view instead of a
                  side-panel dashboard.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Viewing {graphRoot.title}</Badge>
                {graphRoot.id !== activeDomain.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGraphRootId(activeDomain.id);
                      setSelectedNodeId(activeDomain.id);
                    }}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                  >
                    <RotateCcw className="size-4" />
                    Show full domain
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {rootDomains.map((domain) => {
              const selected = domain.id === activeDomain.id;

              return (
                <button
                  key={domain.id}
                  type="button"
                  onClick={() => handleDomainChange(domain.id)}
                  className={cn(
                    "rounded-[26px] border px-5 py-4 text-left transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/10 shadow-[var(--shadow-active)]"
                      : "border-border/70 bg-background/75 hover:bg-muted/35",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Domain {domain.sequenceIndex + 1}
                      </p>
                      <p className="text-base font-semibold leading-6 text-foreground">{domain.title}</p>
                    </div>
                    <Badge variant={selected ? "secondary" : "outline"}>{countSkills(domain)} skills</Badge>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-[32px] border border-border/70 bg-background/80 p-4 shadow-inner">
            <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{graphRoot.title}</p>
                <p className="text-sm text-muted-foreground">
                  Click a node to redraw the graph around that branch. Leaf skills stay highlighted
                  in place so you can still read the larger sequence.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {graphLayout.levels.map((level) => (
                  <Badge key={level} variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
                    {typeLabel[level]}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-4 hidden md:block">
              <div className="relative overflow-hidden rounded-[26px] border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.1),_transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.2))] p-4 dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.08),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.76),rgba(2,6,23,0.46))]">
                <div className="relative" style={{ height: `${graphLayout.height}px` }}>
                  <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`} preserveAspectRatio="none" aria-hidden="true">
                    {graphLayout.edges.map((edge) => {
                      const highlighted = highlightedIds.has(edge.fromId) && highlightedIds.has(edge.toId);

                      return (
                        <path
                          key={`${edge.fromId}-${edge.toId}`}
                          d={edge.path}
                          fill="none"
                          stroke={highlighted ? "hsl(var(--primary))" : "color-mix(in srgb, hsl(var(--muted-foreground)) 28%, transparent)"}
                          strokeOpacity={highlighted ? 0.7 : 0.22}
                          strokeWidth={highlighted ? 3 : 2}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>

                  {graphLayout.nodes.map((position) => {
                    const node = position.node;
                    const Icon = typeIcon[node.normalizedType];
                    const selected = node.id === selectedNode.id;
                    const highlighted = highlightedIds.has(node.id);

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => handleNodeClick(node)}
                        className={cn(
                          "absolute flex flex-col justify-between rounded-[24px] border p-4 text-left shadow-sm transition-all",
                          nodeSurface[node.normalizedType],
                          selected && "scale-[1.01] border-primary bg-primary/12 shadow-[var(--shadow-active)]",
                          !selected && highlighted && "border-primary/25",
                          !highlighted && "opacity-35",
                        )}
                        style={{
                          left: `${(position.left / graphLayout.width) * 100}%`,
                          top: `${position.top}px`,
                          width: `${(graphLayout.nodeWidth / graphLayout.width) * 100}%`,
                          height: `${graphLayout.nodeHeight}px`,
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Badge variant={selected ? "secondary" : "outline"} className="text-[10px] uppercase tracking-[0.16em]">
                              {typeLabel[node.normalizedType]}
                            </Badge>
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Step {node.sequenceIndex + 1}
                            </p>
                            <p className="mt-2 line-clamp-3 text-sm font-semibold leading-5 text-foreground">
                              {node.title}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{node.children.length} next</span>
                          <span>{countSkills(node)} skills</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              <p className="text-sm text-muted-foreground">
                The full graph is designed for a wider canvas. On smaller screens, use the domain
                selector above and the current branch list below.
              </p>
              <div className="grid gap-3">
                {graphLayout.nodes.map((position) => {
                  const node = position.node;
                  const selected = node.id === selectedNode.id;

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => handleNodeClick(node)}
                      className={cn(
                        "rounded-[22px] border p-4 text-left transition-colors",
                        nodeSurface[node.normalizedType],
                        selected && "border-primary bg-primary/12 shadow-[var(--shadow-active)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {typeLabel[node.normalizedType]} • Step {node.sequenceIndex + 1}
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-5 text-foreground">{node.title}</p>
                        </div>
                        <Badge variant="outline">{countSkills(node)} skills</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
