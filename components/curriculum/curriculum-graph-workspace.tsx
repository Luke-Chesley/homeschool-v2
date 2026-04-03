"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  FolderTree,
  Layers3,
  LocateFixed,
  Network,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";

import { CurriculumSourceSelector } from "@/components/curriculum/curriculum-source-selector";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  centerY: number;
  left: number;
  top: number;
  depth: number;
  node: CurriculumTreeNode;
}

interface GraphEdgePosition {
  fromId: string;
  toId: string;
  path: string;
}

interface GraphLayout {
  width: number;
  height: number;
  nodes: GraphNodePosition[];
  edges: GraphEdgePosition[];
  levels: CurriculumNodeType[];
}

const NODE_WIDTH = 244;
const NODE_HEIGHT = 132;
const COLUMN_GAP = 96;
const LEAF_GAP = 28;
const GRAPH_PADDING_X = 40;
const GRAPH_PADDING_Y = 48;
const MIN_GRAPH_HEIGHT = 560;

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
  domain: "border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/20",
  strand: "border-sky-400/60 bg-sky-50/80 dark:bg-sky-950/20",
  goal_group: "border-emerald-400/60 bg-emerald-50/80 dark:bg-emerald-950/20",
  skill: "border-rose-400/60 bg-rose-50/80 dark:bg-rose-950/20",
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

function countDescendants(node: CurriculumTreeNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function collectDescendantIds(node: CurriculumTreeNode, acc = new Set<string>()) {
  acc.add(node.id);
  for (const child of node.children) {
    collectDescendantIds(child, acc);
  }
  return acc;
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

function getAncestorIds(nodeId: string, parentMap: Map<string, string | null>) {
  const ancestorIds = new Set<string>();
  let currentId: string | null | undefined = nodeId;

  while (currentId) {
    ancestorIds.add(currentId);
    currentId = parentMap.get(currentId) ?? null;
  }

  return ancestorIds;
}

function buildEdgePath(parent: GraphNodePosition, child: GraphNodePosition) {
  const startX = parent.left + NODE_WIDTH;
  const startY = parent.top + NODE_HEIGHT / 2;
  const endX = child.left;
  const endY = child.top + NODE_HEIGHT / 2;
  const deltaX = endX - startX;
  const controlOffset = Math.max(deltaX * 0.38, 48);

  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
}

function buildGraphLayout(root: CurriculumTreeNode): GraphLayout {
  const edges: GraphEdgePosition[] = [];
  const nodesByDepth = new Map<number, CurriculumTreeNode[]>();
  const nodeMap = new Map<string, GraphNodePosition>();
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

  const nodes: GraphNodePosition[] = [];

  for (const [depth, columnNodes] of [...nodesByDepth.entries()].sort((left, right) => left[0] - right[0])) {
    columnNodes.forEach((node, index) => {
      const top = GRAPH_PADDING_Y + index * (NODE_HEIGHT + LEAF_GAP);
      const position: GraphNodePosition = {
        node,
        depth,
        top,
        centerY: top + NODE_HEIGHT / 2,
        left: GRAPH_PADDING_X + depth * (NODE_WIDTH + COLUMN_GAP),
      };

      nodes.push(position);
      nodeMap.set(node.id, position);
    });
  }

  for (const position of nodes) {
    for (const child of sortNodes(position.node.children)) {
      const childPosition = nodeMap.get(child.id);

      if (!childPosition) {
        continue;
      }

      edges.push({
        fromId: position.node.id,
        toId: child.id,
        path: buildEdgePath(position, childPosition),
      });
    }
  }

  const tallestColumn = Math.max(...[...nodesByDepth.values()].map((column) => column.length), 1);

  return {
    nodes,
    edges,
    levels: Array.from(levels),
    width: GRAPH_PADDING_X * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP,
    height:
      Math.max(
        MIN_GRAPH_HEIGHT,
        GRAPH_PADDING_Y * 2 + tallestColumn * NODE_HEIGHT + Math.max(tallestColumn - 1, 0) * LEAF_GAP,
      ),
  };
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
  const graphScrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const firstDomain = sortNodes(tree.rootNodes)[0];
    const nextId = firstDomain?.id ?? "";
    setActiveDomainId(nextId);
    setGraphRootId(nextId);
    setSelectedNodeId(nextId);
  }, [tree.source.id, tree.rootNodes]);

  const activeDomain =
    rootDomains.find((domain) => domain.id === activeDomainId) ?? rootDomains[0] ?? null;

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

  const domainIndex = indexSubtree(activeDomain);
  const graphRoot = domainIndex.nodeMap.get(graphRootId) ?? activeDomain;
  const graphIndex = indexSubtree(graphRoot);
  const selectedNode = graphIndex.nodeMap.get(selectedNodeId) ?? graphRoot;
  const selectedAncestors = getAncestorIds(selectedNode.id, graphIndex.parentMap);
  const selectedDescendants = collectDescendantIds(selectedNode);
  const highlightedIds = new Set([...selectedAncestors, ...selectedDescendants]);
  const graphLayout = buildGraphLayout(graphRoot);
  const selectedChildren = sortNodes(selectedNode.children);
  const activeLineage = Array.from(selectedAncestors)
    .map((nodeId) => graphIndex.nodeMap.get(nodeId))
    .filter((node): node is CurriculumTreeNode => Boolean(node))
    .reverse();

  useEffect(() => {
    graphScrollerRef.current?.scrollTo({ left: 0, top: 0 });
  }, [graphRoot.id, tree.source.id]);

  useEffect(() => {
    const graphScroller = graphScrollerRef.current;
    const graphNode = graphScroller?.querySelector<HTMLElement>(
      `[data-graph-node-id="${CSS.escape(selectedNode.id)}"]`,
    );

    graphNode?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedNode.id]);

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <CurriculumSourceSelector
          sources={sources}
          selectedSourceId={selectedSourceId}
          basePath="/curriculum/graph"
        />

        <Card className="bg-[radial-gradient(circle_at_top,_rgba(217,119,6,0.1),_transparent_55%),_var(--color-card)]">
          <CardHeader>
            <CardTitle className="text-base">Graph controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Pick a domain across the source, then click any node in the canvas to inspect its
              branch and connected sequence.
            </p>
            <Link
              href={`/curriculum?sourceId=${selectedSourceId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center")}
            >
              Return to overview tree
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selected node</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn("rounded-2xl border p-4", nodeSurface[selectedNode.normalizedType])}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {typeLabel[selectedNode.normalizedType]}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl leading-tight">{selectedNode.title}</h2>
                </div>
                <Badge variant="outline">Step {selectedNode.sequenceIndex + 1}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {selectedNode.description?.trim() || selectedNode.normalizedPath}
              </p>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                <span className="text-muted-foreground">Children</span>
                <span className="font-semibold">{selectedNode.children.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                <span className="text-muted-foreground">Descendants</span>
                <span className="font-semibold">{countDescendants(selectedNode)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                <span className="text-muted-foreground">Skills in branch</span>
                <span className="font-semibold">{countSkills(selectedNode)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Lineage
              </p>
              <div className="flex flex-wrap gap-2">
                {activeLineage.map((node, index) => (
                  <div key={node.id} className="flex items-center gap-2">
                    <Badge variant={node.id === selectedNode.id ? "secondary" : "outline"}>
                      {node.title}
                    </Badge>
                    {index < activeLineage.length - 1 ? (
                      <ArrowRight className="size-3 text-muted-foreground" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setGraphRootId(selectedNode.id);
                  setSelectedNodeId(selectedNode.id);
                }}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "w-full justify-center",
                )}
              >
                <LocateFixed className="size-4" />
                Focus this branch
              </button>
              <button
                type="button"
                onClick={() => {
                  setGraphRootId(activeDomain.id);
                  setSelectedNodeId(activeDomain.id);
                }}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full justify-center",
                )}
              >
                <RotateCcw className="size-4" />
                Reset to domain
              </button>
            </div>

            {selectedChildren.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Next nodes
                </p>
                <div className="space-y-2">
                  {selectedChildren.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedNodeId(child.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-left text-sm hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{child.title}</span>
                      <Badge variant="outline" className="ml-3 text-[10px] uppercase tracking-[0.14em]">
                        {typeLabel[child.normalizedType]}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card className="min-w-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(234,179,8,0.1),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_35%),var(--color-card)]">
          <CardHeader className="gap-4 border-b border-border/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Network className="size-4 text-primary" />
                  Logical curriculum graph
                </div>
                <div>
                  <h2 className="font-serif text-3xl leading-tight tracking-tight">{tree.source.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Domains run in sequence across the top. Inside the canvas, each node is connected
                    to the next hierarchy level with explicit edges so you can see how the curriculum
                    unfolds from one branch to the next.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{tree.nodeCount} nodes</Badge>
                <Badge variant="outline">{tree.skillCount} skills</Badge>
                <Badge variant="outline">Focused on {typeLabel[graphRoot.normalizedType]}</Badge>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-3">
                {rootDomains.map((domain, index) => (
                  <div key={domain.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDomainId(domain.id);
                        setGraphRootId(domain.id);
                        setSelectedNodeId(domain.id);
                      }}
                      className={cn(
                        "group rounded-full border px-4 py-3 text-left transition-colors",
                        domain.id === activeDomain.id
                          ? "border-primary/40 bg-primary/10 text-foreground shadow-[var(--shadow-active)]"
                          : "border-border/70 bg-background/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-card text-xs font-semibold text-foreground">
                          {domain.sequenceIndex + 1}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Domain
                          </p>
                          <p className="max-w-[18rem] text-sm font-medium text-foreground">{domain.title}</p>
                        </div>
                      </div>
                    </button>
                    {index < rootDomains.length - 1 ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="h-px w-10 bg-border/70" />
                        <ArrowRight className="size-4" />
                        <div className="h-px w-10 bg-border/70" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Showing <span className="text-primary">{graphRoot.title}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click any node to inspect it. Focus a node to redraw the graph around that branch.
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

            <div className="min-w-0 rounded-[28px] border border-border/70 bg-background/80 p-3 shadow-inner">
              <div
                ref={graphScrollerRef}
                className="overflow-auto rounded-[22px] border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.1),_transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.18))] dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.08),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.7),rgba(2,6,23,0.45))]"
              >
                <div
                  className="relative"
                  style={{
                    width: `${graphLayout.width}px`,
                    height: `${graphLayout.height}px`,
                  }}
                >
                  <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                    {graphLayout.edges.map((edge) => {
                      const highlighted =
                        highlightedIds.has(edge.fromId) && highlightedIds.has(edge.toId);

                      return (
                        <path
                          key={`${edge.fromId}-${edge.toId}`}
                          d={edge.path}
                          fill="none"
                          stroke={highlighted ? "hsl(var(--primary))" : "color-mix(in srgb, hsl(var(--muted-foreground)) 30%, transparent)"}
                          strokeOpacity={highlighted ? 0.7 : 0.2}
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
                        data-graph-node-id={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={cn(
                          "absolute flex h-[132px] w-[244px] flex-col justify-between rounded-[24px] border p-4 text-left shadow-sm transition-all",
                          nodeSurface[node.normalizedType],
                          selected && "scale-[1.02] border-primary bg-primary/12 shadow-[var(--shadow-active)]",
                          !selected && highlighted && "border-primary/25 shadow-md",
                          !highlighted && "opacity-45",
                        )}
                        style={{
                          left: `${position.left}px`,
                          top: `${position.top}px`,
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Badge variant={selected ? "secondary" : "outline"} className="text-[10px] uppercase tracking-[0.18em]">
                              {typeLabel[node.normalizedType]}
                            </Badge>
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Step {node.sequenceIndex + 1}
                            </p>
                            <p className="mt-1 max-h-[3.9rem] overflow-hidden text-sm font-semibold leading-5 text-foreground">
                              {node.title}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{node.children.length} next</span>
                          {node.code ? <span className="truncate font-medium">{node.code}</span> : <span>{countSkills(node)} skills</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What this graph is showing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" />
                Explicit connections
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Each edge is a real parent-child relationship from the normalized curriculum tree.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <LocateFixed className="size-4 text-primary" />
                Branch focus
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Focus on any node to redraw the canvas around that branch instead of reading every
                sibling at once.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ArrowRight className="size-4 text-primary" />
                Ordered flow
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Sequence numbers stay visible on every node, so hierarchy and execution order are
                readable at the same time.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
