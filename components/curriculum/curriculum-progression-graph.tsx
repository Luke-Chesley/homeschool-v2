"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Info, RefreshCw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressionPromptPreview } from "@/components/curriculum/ProgressionPromptPreview";
import type { CurriculumSource } from "@/lib/curriculum/types";
import type {
  ProgressionGraph,
  ProgressionGraphEdge,
  ProgressionGraphNode,
  ProgressionEdgeKind,
} from "@/lib/curriculum/progression-graph-model";
import { cn } from "@/lib/utils";

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W = 176;
const NODE_H = 64;
const COL_GAP = 80;
const ROW_GAP = 10;
const PAD_X = 24;
const PAD_Y = 32;
const DOMAIN_PAD = 8;
const DOMAIN_LABEL_H = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

interface DomainBand {
  domainId: string;
  domainTitle: string;
  colIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  colorClass: string;
}

interface LayoutResult {
  nodePositions: Map<string, NodePosition>;
  domainBands: DomainBand[];
  totalWidth: number;
  totalHeight: number;
}

// ── Domain colours ────────────────────────────────────────────────────────────

const DOMAIN_COLORS = [
  { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)", label: "#a16207" },
  { bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.25)", label: "#0369a1" },
  { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.22)", label: "#166534" },
  { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.22)", label: "#7e22ce" },
  { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.22)", label: "#c2410c" },
  { bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.2)", label: "#9d174d" },
];

function domainColor(index: number) {
  return DOMAIN_COLORS[index % DOMAIN_COLORS.length];
}

// ── Edge styling ───────────────────────────────────────────────────────────────

function edgeStyle(kind: ProgressionEdgeKind): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
} {
  switch (kind) {
    case "hardPrerequisite":
      return { stroke: "hsl(var(--foreground))", strokeWidth: 2, opacity: 0.7 };
    case "recommendedBefore":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1.5, strokeDasharray: "6 3", opacity: 0.6 };
    case "revisitAfter":
      return { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5, strokeDasharray: "3 4", opacity: 0.45 };
    case "coPractice":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "2 3", opacity: 0.4 };
    case "explicit":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1.5, opacity: 0.55 };
    case "inferred":
    default:
      return { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.25 };
  }
}

function edgeLegendLabel(kind: ProgressionEdgeKind): string {
  switch (kind) {
    case "hardPrerequisite": return "Hard prerequisite";
    case "recommendedBefore": return "Recommended before";
    case "revisitAfter": return "Revisit after";
    case "coPractice": return "Co-practice";
    case "explicit": return "Explicit";
    case "inferred": return "Inferred sequence";
  }
}

// ── Layout engine ─────────────────────────────────────────────────────────────

function computeLayout(graph: ProgressionGraph): LayoutResult {
  const nodePositions = new Map<string, NodePosition>();
  const domainBands: DomainBand[] = [];

  // Index domain sequence for colours
  const domainIndexMap = new Map<string, number>();
  graph.groups.forEach((g, i) => domainIndexMap.set(g.domainId, i));

  // Get node lookup
  const nodeMap = new Map<string, ProgressionGraphNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  let maxX = 0;
  let maxY = 0;

  for (const col of graph.columns) {
    const colX = PAD_X + col.index * (NODE_W + COL_GAP);
    let curY = PAD_Y;

    // Group nodes in this column by domain (preserve sorted order from model)
    const domainOrder: string[] = [];
    const byDomain = new Map<string, string[]>();
    for (const id of col.nodeIds) {
      const n = nodeMap.get(id);
      if (!n) continue;
      if (!byDomain.has(n.domainId)) {
        domainOrder.push(n.domainId);
        byDomain.set(n.domainId, []);
      }
      byDomain.get(n.domainId)!.push(id);
    }

    for (const domainId of domainOrder) {
      const domainNodeIds = byDomain.get(domainId) ?? [];
      const groupStartY = curY;

      // Add domain label height
      curY += DOMAIN_LABEL_H + DOMAIN_PAD;

      for (const id of domainNodeIds) {
        nodePositions.set(id, { id, x: colX, y: curY });
        curY += NODE_H + ROW_GAP;
        maxX = Math.max(maxX, colX + NODE_W);
        maxY = Math.max(maxY, curY);
      }

      const groupHeight = curY - groupStartY - ROW_GAP;
      const colorIdx = domainIndexMap.get(domainId) ?? 0;
      domainBands.push({
        domainId,
        domainTitle: graph.groups.find((g) => g.domainId === domainId)?.domainTitle ?? domainId,
        colIndex: col.index,
        x: colX - DOMAIN_PAD,
        y: groupStartY,
        width: NODE_W + DOMAIN_PAD * 2,
        height: Math.max(groupHeight, NODE_H + DOMAIN_LABEL_H + DOMAIN_PAD * 2),
        colorClass: colorIdx.toString(),
      });

      curY += DOMAIN_PAD; // inter-domain gap
    }
  }

  return {
    nodePositions,
    domainBands,
    totalWidth: maxX + PAD_X,
    totalHeight: maxY + PAD_Y,
  };
}

// ── Edge path ─────────────────────────────────────────────────────────────────

function buildEdgePath(
  from: NodePosition,
  to: NodePosition,
): string {
  const startX = from.x + NODE_W;
  const startY = from.y + NODE_H / 2;
  const endX = to.x;
  const endY = to.y + NODE_H / 2;
  const ctrl = Math.max((endX - startX) * 0.45, 24);
  return `M ${startX} ${startY} C ${startX + ctrl} ${startY}, ${endX - ctrl} ${endY}, ${endX} ${endY}`;
}

// ── Source bar ────────────────────────────────────────────────────────────────

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
        return (
          <Link
            key={source.id}
            href={`/curriculum/graph?sourceId=${source.id}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              selected
                ? "border-primary/40 bg-primary/10 text-foreground"
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

// ── Diagnostics status bar ───────────────────────────────────────────────────

function progressionStatusMessage(
  status: string,
  hasExplicitProgression: boolean,
  lastFailureReason: string | null,
  rawAttemptSummaries?: any[],
): { label: string; detail: string | null; missingSkillCount?: number } {
  // Extract missing skill count from last failed attempt if present.
  let missingSkillCount: number | undefined;
  if (rawAttemptSummaries && rawAttemptSummaries.length > 0) {
    const lastAttempt = rawAttemptSummaries[rawAttemptSummaries.length - 1];
    if (lastAttempt?.missingSkillRefs?.length > 0) {
      missingSkillCount = lastAttempt.missingSkillRefs.length;
    } else if (lastAttempt?.summary?.missingSkillRefs > 0) {
      missingSkillCount = lastAttempt.summary.missingSkillRefs;
    }
  }

  switch (status) {
    case "explicit_ready":
      return { label: "Explicit progression ready", detail: null };
    case "explicit_failed":
      return {
        label: "Progression generation failed — using inferred fallback.",
        detail: lastFailureReason
          ? `Last failure: ${lastFailureReason}`
          : "Regenerate to retry.",
        missingSkillCount,
      };
    case "fallback_only":
      return {
        label: "Progression was not accepted during generation. Using inferred fallback.",
        detail: "Regenerate to retry.",
        missingSkillCount,
      };
    case "stale":
      return {
        label: "Progression exists but is stale.",
        detail: "Curriculum was updated since last progression generation. Regenerate to refresh.",
      };
    case "not_attempted":
      return {
        label: hasExplicitProgression ? "Explicit progression ready" : "Progression not yet generated.",
        detail: hasExplicitProgression ? null : "Run regeneration to build an explicit progression.",
      };
    default:
      return {
        label: hasExplicitProgression
          ? "Explicit progression ready"
          : "Explicit progression unavailable. Using inferred fallback.",
        detail: null,
      };
  }
}

interface DiagnosticsBarProps {
  graph: ProgressionGraph;
  sourceId: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
  regenerateResult: { kind: string; reason?: string; phaseCount?: number } | null;
  debugOpen: boolean;
  setDebugOpen: (open: boolean) => void;
  viewAttemptsOpen: boolean;
  setViewAttemptsOpen: (open: boolean) => void;
}

function DiagnosticsBar({
  graph,
  sourceId,
  onRegenerate,
  isRegenerating,
  regenerateResult,
  debugOpen,
  setDebugOpen,
  viewAttemptsOpen,
  setViewAttemptsOpen,
}: DiagnosticsBarProps) {
  const { diagnostics } = graph;
  const status = (diagnostics as any).progressionStatus ?? (diagnostics.hasExplicitProgression ? "explicit_ready" : "fallback_only");
  const isExplicit = status === "explicit_ready";
  const isStale = status === "stale";
  const rawAttemptSummaries = (diagnostics as any).rawAttemptSummaries as any[] | undefined;

  const { label, detail, missingSkillCount } = progressionStatusMessage(
    status,
    diagnostics.hasExplicitProgression,
    (diagnostics as any).lastFailureReason ?? null,
    rawAttemptSummaries,
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-sm",
          isExplicit
            ? "border-emerald-400/40 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            : isStale
              ? "border-blue-400/40 bg-blue-50/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
              : "border-amber-400/40 bg-amber-50/60 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
        )}
      >
        {isExplicit ? (
          <CheckCircle2 className="size-4 shrink-0" />
        ) : (
          <AlertTriangle className="size-4 shrink-0" />
        )}
        <span className="font-medium">{label}</span>
        <span className="text-xs opacity-70">
          {diagnostics.phaseCount > 0 && `${diagnostics.phaseCount} phases · `}
          {graph.edges.length} edges · {graph.nodes.length} skills
          {missingSkillCount && missingSkillCount > 0 && (
            <span className="ml-1 font-semibold text-red-600 opacity-100">
              · {missingSkillCount} skill{missingSkillCount !== 1 ? "s" : ""} unassigned
            </span>
          )}
          {diagnostics.droppedEdgeCount > 0 && ` · ${diagnostics.droppedEdgeCount} edges dropped`}
          {(diagnostics as any).attemptCount > 0 && ` · ${(diagnostics as any).attemptCount} attempt${(diagnostics as any).attemptCount !== 1 ? "s" : ""}`}
        </span>
        <div className="ml-auto shrink-0 flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDebugOpen(!debugOpen)}
            className="h-7 text-xs"
          >
            {debugOpen ? "Hide prompt" : "View prompt"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewAttemptsOpen(!viewAttemptsOpen)}
            className="h-7 text-xs"
          >
            {viewAttemptsOpen ? "Hide attempts" : `View attempts${rawAttemptSummaries?.length ? ` (${rawAttemptSummaries.length})` : ""}`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-7 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("size-3", isRegenerating && "animate-spin")} />
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      </div>

      {detail && !regenerateResult && (
        <p className="px-1 text-xs text-muted-foreground">{detail}</p>
      )}

      {regenerateResult && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            regenerateResult.kind === "success"
              ? "border-emerald-400/40 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-red-400/40 bg-red-50/60 text-red-800 dark:bg-red-950/30 dark:text-red-300",
          )}
        >
          {regenerateResult.kind === "success"
            ? `Progression regenerated — ${regenerateResult.phaseCount ?? 0} phases accepted. Reload the page to see the updated graph.`
            : `Regeneration failed: ${regenerateResult.reason ?? "Unknown error."}`}
        </div>
      )}
    </div>
  );
}

// ── Node detail popover ───────────────────────────────────────────────────────

interface NodeDetailProps {
  node: ProgressionGraphNode;
  inEdges: ProgressionGraphEdge[];
  outEdges: ProgressionGraphEdge[];
  graph: ProgressionGraph;
  onClose: () => void;
}

function NodeDetail({ node, inEdges, outEdges, graph, onClose }: NodeDetailProps) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-border/70 bg-card p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Skill
          </p>
          <p className="text-sm font-semibold leading-5 text-foreground">{node.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground/70">Domain:</span> {node.domainTitle}
        </div>
        {node.strandTitle && (
          <div>
            <span className="font-medium text-foreground/70">Strand:</span> {node.strandTitle}
          </div>
        )}
        {node.goalGroupTitle && (
          <div>
            <span className="font-medium text-foreground/70">Goal group:</span> {node.goalGroupTitle}
          </div>
        )}
        {node.phaseTitle && (
          <div>
            <span className="font-medium text-foreground/70">Phase:</span> {node.phaseTitle}
          </div>
        )}
        {!node.isExplicitlyPhased && (
          <div className="italic opacity-70">No explicit phase assigned</div>
        )}
      </div>

      {outEdges.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Required before
          </p>
          {outEdges.map((e) => {
            const target = nodeMap.get(e.toId);
            return (
              <div key={e.toId} className="flex items-center gap-2 text-xs">
                <span className="inline-block size-1.5 rounded-full bg-foreground/40" />
                <span className="text-foreground/80">{target?.title ?? e.toId}</span>
                <Badge variant="outline" className="text-[9px] uppercase tracking-[0.12em]">
                  {edgeLegendLabel(e.kind)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {inEdges.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Requires
          </p>
          {inEdges.map((e) => {
            const src = nodeMap.get(e.fromId);
            return (
              <div key={e.fromId} className="flex items-center gap-2 text-xs">
                <span className="inline-block size-1.5 rounded-full bg-foreground/40" />
                <span className="text-foreground/80">{src?.title ?? e.fromId}</span>
                <Badge variant="outline" className="text-[9px] uppercase tracking-[0.12em]">
                  {edgeLegendLabel(e.kind)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Edge legend ───────────────────────────────────────────────────────────────

function EdgeLegend({ kinds }: { kinds: ProgressionEdgeKind[] }) {
  if (kinds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {kinds.map((kind) => {
        const style = edgeStyle(kind);
        return (
          <div key={kind} className="flex items-center gap-1.5">
            <svg width="24" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="24"
                y2="4"
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                opacity={style.opacity * 1.4}
              />
            </svg>
            <span>{edgeLegendLabel(kind)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CurriculumProgressionGraphProps {
  sources: CurriculumSource[];
  selectedSourceId: string;
  graph: ProgressionGraph;
  progressionDebug?: unknown;
  regenerateAction?: (sourceId: string) => Promise<{ kind: string; reason?: string; phaseCount?: number; attemptCount?: number }>;
}


function StatusBadge({ value, okLabel = "ok" }: { value: string; okLabel?: string }) {
  const isOk = value === "ok" || value === okLabel;
  const isError = value === "error";
  const isSkipped = value === "not_attempted";
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
        isOk && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
        isError && "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
        isSkipped && "bg-muted text-muted-foreground",
      )}
    >
      {isSkipped ? "—" : value}
    </span>
  );
}

function AttemptCard({ attempt }: { attempt: any }) {
  const [rawOpen, setRawOpen] = useState(false);
  const [parsedOpen, setParsedOpen] = useState(false);

  return (
    <div className="text-xs space-y-2 p-3 border rounded bg-background">
      {/* Header */}
      <div className="flex justify-between font-medium border-b pb-1.5 mb-1">
        <span className="text-sm">Attempt {attempt.attemptNumber}</span>
        <span className={cn("text-sm font-semibold", attempt.accepted ? "text-emerald-600" : "text-red-600")}>
          {attempt.accepted ? "Accepted" : "Failed"}
          {attempt.repairAttempt?.success && " (after repair)"}
        </span>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
        <div className="col-span-1 font-medium text-muted-foreground">Transport</div>
        <div className="col-span-1"><StatusBadge value={attempt.transportStatus} okLabel="ok" /></div>
        <div className="col-span-1 font-medium text-muted-foreground">Parse</div>
        <div className="col-span-1">
          <StatusBadge value={attempt.parseStatus} />
          {attempt.parseFailureKind && (
            <span className="ml-1 text-muted-foreground">({attempt.parseFailureKind})</span>
          )}
        </div>
        <div className="col-span-1 font-medium text-muted-foreground">Schema</div>
        <div className="col-span-1"><StatusBadge value={attempt.schemaStatus} /></div>
        <div className="col-span-1 font-medium text-muted-foreground">Semantic</div>
        <div className="col-span-1"><StatusBadge value={attempt.semanticStatus} /></div>
      </div>

      {/* Coverage summary */}
      {attempt.summary && (
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground pt-1 border-t">
          <span>Phases: <strong className="text-foreground">{attempt.summary.phaseCount}</strong></span>
          <span>Edges: <strong className="text-foreground">{attempt.summary.edgeCount}</strong></span>
          {attempt.summary.missingSkillRefs > 0 && (
            <span className="text-red-600 font-medium">
              Missing skills: {attempt.summary.missingSkillRefs}
            </span>
          )}
          {attempt.summary.duplicatePhaseAssignments > 0 && (
            <span className="text-amber-600 font-medium">
              Duplicates: {attempt.summary.duplicatePhaseAssignments}
            </span>
          )}
          {attempt.summary.hardPrerequisiteCycle && (
            <span className="text-red-600 font-medium">Cycle detected</span>
          )}
        </div>
      )}

      {/* Failure reason */}
      {attempt.failureReason && (
        <div className="text-red-600 text-[11px] break-words">
          <strong>Failure:</strong> {attempt.failureReason}
        </div>
      )}

      {/* Sanitization note */}
      {attempt.sanitizationChanged && (
        <div className="text-amber-600 text-[11px]">
          Ref sanitization applied ({attempt.sanitizationResults?.filter((r: any) => r.changed).length} refs corrected)
        </div>
      )}

      {/* Repair attempt note */}
      {attempt.repairAttempt?.attempted && (
        <div className={cn("text-[11px]", attempt.repairAttempt.success ? "text-emerald-600" : "text-amber-600")}>
          Repair pass: {attempt.repairAttempt.success ? "succeeded" : `failed — ${attempt.repairAttempt.failureReason}`}
        </div>
      )}

      {/* Missing skillRefs list */}
      {attempt.missingSkillRefs && attempt.missingSkillRefs.length > 0 && (
        <div className="text-[11px]">
          <strong className="text-red-600">Missing skillRefs ({attempt.missingSkillRefs.length}):</strong>
          <ul className="mt-1 space-y-0.5 text-muted-foreground font-mono">
            {(attempt.missingSkillRefs as string[]).slice(0, 10).map((ref: string) => (
              <li key={ref} className="truncate">{ref}</li>
            ))}
            {attempt.missingSkillRefs.length > 10 && (
              <li className="text-muted-foreground">… and {attempt.missingSkillRefs.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Validation issues */}
      {attempt.validationIssues && attempt.validationIssues.length > 0 && (
        <div className="text-[11px]">
          <strong className="text-foreground/70">Validation issues:</strong>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {(attempt.validationIssues as any[]).slice(0, 8).map((issue: any, idx: number) => (
              <li key={idx}>
                <span className="font-mono text-red-600">{issue.code}</span>
                {" — "}
                <span className="break-words">{issue.message}</span>
              </li>
            ))}
            {attempt.validationIssues.length > 8 && (
              <li className="text-muted-foreground">… and {attempt.validationIssues.length - 8} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Raw response toggle */}
      {attempt.rawResponse && (
        <div className="text-[11px]">
          <button
            type="button"
            onClick={() => setRawOpen((v) => !v)}
            className="text-muted-foreground underline hover:text-foreground"
          >
            {rawOpen ? "Hide raw response" : "Show raw response"}
          </button>
          {rawOpen && (
            <pre className="mt-2 max-h-64 overflow-auto rounded border bg-muted/30 p-2 font-mono text-[10px] whitespace-pre-wrap break-words">
              {attempt.rawResponse}
            </pre>
          )}
        </div>
      )}

      {/* Parsed JSON toggle */}
      {attempt.parsedJson && (
        <div className="text-[11px]">
          <button
            type="button"
            onClick={() => setParsedOpen((v) => !v)}
            className="text-muted-foreground underline hover:text-foreground"
          >
            {parsedOpen ? "Hide parsed JSON" : "Show parsed JSON"}
          </button>
          {parsedOpen && (
            <pre className="mt-2 max-h-64 overflow-auto rounded border bg-muted/30 p-2 font-mono text-[10px] whitespace-pre-wrap break-words">
              {JSON.stringify(attempt.parsedJson, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ViewAttemptsPanel({ attempts }: { attempts: any[] }) {
  if (!attempts || attempts.length === 0) {
    return (
      <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
        No attempt data stored. Regenerate to populate.
      </div>
    );
  }
  return (
    <div className="rounded-md border p-4 space-y-3 bg-muted/10">
      <h3 className="font-semibold text-sm">
        Attempt diagnostics ({attempts.length} attempt{attempts.length !== 1 ? "s" : ""})
      </h3>
      <div className="space-y-3">
        {attempts.map((attempt, i) => (
          <AttemptCard key={i} attempt={attempt} />
        ))}
      </div>
    </div>
  );
}

export function CurriculumProgressionGraph({
  sources,
  selectedSourceId,
  graph,
  progressionDebug,
  regenerateAction,
}: CurriculumProgressionGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [viewAttemptsOpen, setViewAttemptsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [regenerateResult, setRegenerateResult] = useState<{ kind: string; reason?: string; phaseCount?: number } | null>(null);

  // Reset selection when source changes.
  useEffect(() => {
    setSelectedNodeId(null);
    setRegenerateResult(null);
  }, [selectedSourceId]);

  function handleRegenerate() {
    if (!regenerateAction) return;
    setRegenerateResult(null);
    startTransition(async () => {
      const result = await regenerateAction(selectedSourceId);
      setRegenerateResult(result);
    });
  }

  const layout = computeLayout(graph);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const domainIndexMap = new Map(graph.groups.map((g, i) => [g.domainId, i]));

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const inEdges = selectedNodeId
    ? graph.edges.filter((e) => e.toId === selectedNodeId)
    : [];
  const outEdges = selectedNodeId
    ? graph.edges.filter((e) => e.fromId === selectedNodeId)
    : [];

  const edgeKindsPresent = [...new Set(graph.edges.map((e) => e.kind))] as ProgressionEdgeKind[];

  if (!graph.hasAnyNodes) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-sm text-muted-foreground">
            No skills to graph for this curriculum source.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Curriculum source
        </p>
        <SourceBar sources={sources} selectedSourceId={selectedSourceId} />
      </div>

      {/* Progression status */}
      <DiagnosticsBar
        graph={graph}
        sourceId={selectedSourceId}
        onRegenerate={handleRegenerate}
        isRegenerating={isPending}
        regenerateResult={regenerateResult}
        debugOpen={debugOpen}
        setDebugOpen={setDebugOpen}
        viewAttemptsOpen={viewAttemptsOpen}
        setViewAttemptsOpen={setViewAttemptsOpen}
      />

      {viewAttemptsOpen && (
        <ViewAttemptsPanel attempts={(graph.diagnostics as any).rawAttemptSummaries ?? []} />
      )}

      {/* Side-by-side: graph + detail panel */}
      <div className={cn("flex gap-4", selectedNode ? "items-start" : "")}>
        {/* Graph canvas */}
        <div className="min-w-0 flex-1">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Column headers */}
              <div
                className="flex border-b border-border/60 bg-muted/30"
                style={{
                  paddingLeft: PAD_X,
                  paddingRight: PAD_X,
                }}
              >
                {graph.columns.map((col) => (
                  <div
                    key={col.index}
                    className="flex shrink-0 items-center gap-2 py-3 pr-4"
                    style={{ width: NODE_W + COL_GAP, minWidth: NODE_W + COL_GAP }}
                  >
                    <span className="text-xs font-semibold text-foreground/70">{col.title}</span>
                    {col.isFallback && (
                      <span title="Inferred order — no explicit phases">
                        <Info className="size-3 text-muted-foreground" />
                      </span>
                    )}
                    <Badge variant="outline" className="ml-auto text-[9px] uppercase tracking-[0.1em]">
                      {col.nodeIds.length}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Scrollable graph area */}
              <div className="overflow-x-auto">
                <div
                  ref={containerRef}
                  className="relative"
                  style={{
                    width: Math.max(layout.totalWidth, 600),
                    height: Math.max(layout.totalHeight, 400),
                  }}
                >
                  {/* Domain band backgrounds */}
                  {layout.domainBands.map((band, i) => {
                    const colIdx = domainIndexMap.get(band.domainId) ?? 0;
                    const color = domainColor(colIdx);
                    return (
                      <div
                        key={`${band.domainId}-${band.colIndex}-${i}`}
                        className="absolute rounded-lg"
                        style={{
                          left: band.x,
                          top: band.y,
                          width: band.width,
                          height: band.height,
                          backgroundColor: color.bg,
                          border: `1px solid ${color.border}`,
                        }}
                      >
                        <span
                          className="block truncate px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          style={{ color: color.label }}
                        >
                          {band.domainTitle}
                        </span>
                      </div>
                    );
                  })}

                  {/* SVG edges */}
                  <svg
                    className="pointer-events-none absolute inset-0"
                    width={layout.totalWidth}
                    height={layout.totalHeight}
                    aria-hidden="true"
                  >
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="6"
                        markerHeight="4"
                        refX="5"
                        refY="2"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 6 2, 0 4"
                          fill="hsl(var(--muted-foreground))"
                          opacity="0.5"
                        />
                      </marker>
                    </defs>
                    {graph.edges.map((edge) => {
                      const fromPos = layout.nodePositions.get(edge.fromId);
                      const toPos = layout.nodePositions.get(edge.toId);
                      if (!fromPos || !toPos) return null;
                      const style = edgeStyle(edge.kind);
                      const isRelated =
                        selectedNodeId &&
                        (edge.fromId === selectedNodeId || edge.toId === selectedNodeId);
                      const dimmed = selectedNodeId && !isRelated;
                      return (
                        <path
                          key={`${edge.fromId}-${edge.toId}`}
                          d={buildEdgePath(fromPos, toPos)}
                          fill="none"
                          stroke={style.stroke}
                          strokeWidth={isRelated ? style.strokeWidth * 1.8 : style.strokeWidth}
                          strokeDasharray={style.strokeDasharray}
                          opacity={dimmed ? style.opacity * 0.3 : style.opacity * (isRelated ? 1.4 : 1)}
                          strokeLinecap="round"
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    })}
                  </svg>

                  {/* Skill nodes */}
                  {graph.nodes.map((node) => {
                    const pos = layout.nodePositions.get(node.id);
                    if (!pos) return null;
                    const isSelected = node.id === selectedNodeId;
                    const isRelated =
                      selectedNodeId &&
                      !isSelected &&
                      graph.edges.some(
                        (e) =>
                          (e.fromId === selectedNodeId && e.toId === node.id) ||
                          (e.toId === selectedNodeId && e.fromId === node.id),
                      );
                    const dimmed = selectedNodeId && !isSelected && !isRelated;

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() =>
                          setSelectedNodeId(isSelected ? null : node.id)
                        }
                        className={cn(
                          "absolute flex flex-col justify-center gap-0.5 rounded-xl border px-3 py-2 text-left text-xs transition-all",
                          "bg-card shadow-sm hover:shadow-md",
                          isSelected
                            ? "z-10 border-primary bg-primary/8 shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]"
                            : isRelated
                              ? "border-primary/30 bg-primary/5"
                              : "border-border/60 hover:border-border",
                          dimmed && "opacity-30",
                          !node.isExplicitlyPhased && "border-dashed",
                        )}
                        style={{
                          left: pos.x,
                          top: pos.y,
                          width: NODE_W,
                          height: NODE_H,
                        }}
                      >
                        <p className="line-clamp-2 font-medium leading-4 text-foreground">
                          {node.title}
                        </p>
                        {node.phaseTitle && (
                          <p className="truncate text-[10px] text-muted-foreground">
                            {node.phaseTitle}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edge legend */}
              {edgeKindsPresent.length > 0 && (
                <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
                  <EdgeLegend kinds={edgeKindsPresent} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <div className="w-72 shrink-0">
            <NodeDetail
              node={selectedNode}
              inEdges={inEdges}
              outEdges={outEdges}
              graph={graph}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
      </div>

      {/* Mobile fallback */}
      <div className="md:hidden">
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-sm text-muted-foreground">
              The progression graph is designed for wider screens. Rotate your device or view on
              desktop for the best experience.
            </p>
            <div className="mt-4 space-y-2">
              {graph.columns.map((col) => (
                <div key={col.index}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {col.title}
                  </p>
                  <div className="grid gap-1">
                    {col.nodeIds.map((id) => {
                      const n = nodeMap.get(id);
                      if (!n) return null;
                      return (
                        <div
                          key={id}
                          className="rounded-lg border border-border/60 px-3 py-2 text-xs"
                        >
                          <p className="font-medium">{n.title}</p>
                          <p className="text-muted-foreground">{n.domainTitle}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progression debug output */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <ProgressionPromptPreview sourceId={selectedSourceId} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDebugOpen((v) => !v)}
            className="justify-between"
          >
            <span>{debugOpen ? "Hide output" : "View output"}</span>
            <span className="ml-2 text-xs text-muted-foreground">debug</span>
          </Button>
        </div>

        {debugOpen && progressionDebug != null ? (
          <div className="rounded-lg border border-border/70 bg-background p-4">
            <p className="text-sm font-medium text-foreground">Progression output</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Raw progression data from DB — phases, prerequisites, and diagnostics.
            </p>
            <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
              {JSON.stringify(progressionDebug, null, 2)}
            </pre>
          </div>
        ) : null}

        {debugOpen && progressionDebug == null ? (
          <p className="px-1 text-xs text-muted-foreground">No progression data available for this source.</p>
        ) : null}
      </div>
    </div>
  );
}
