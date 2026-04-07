/**
 * Progression graph view model.
 *
 * Pure function — no DB access. Takes CurriculumTree + CurriculumProgressionData
 * and returns a graph model ready for the renderer.
 *
 * Layout is left-to-right by phase. Phases are columns; skills are nodes within columns.
 * Within each column, skills are grouped by domain, sorted by canonical order.
 * If no phases exist, all skills go in a single "fallback" column ordered canonically.
 */

import type { CurriculumTree, CurriculumTreeNode } from "./types";
import type {
  CurriculumProgressionData,
  CurriculumProgressionDiagnostics,
} from "./service";

// ── Node ────────────────────────────────────────────────────────────────────

export interface ProgressionGraphNode {
  id: string;
  title: string;
  /** Phase column index (0-based). null means no explicit phase → placed in fallback column. */
  columnIndex: number;
  phaseTitle: string | null;
  isExplicitlyPhased: boolean;
  /** Canonical order within the full curriculum (from metadata.canonicalSequenceIndex). */
  canonicalOrder: number;
  domainId: string;
  domainTitle: string;
  strandId: string | null;
  strandTitle: string | null;
  goalGroupId: string | null;
  goalGroupTitle: string | null;
}

// ── Edge ────────────────────────────────────────────────────────────────────

export type ProgressionEdgeKind =
  | "hardPrerequisite"
  | "recommendedBefore"
  | "revisitAfter"
  | "coPractice"
  | "inferred"
  | "explicit";

export interface ProgressionGraphEdge {
  fromId: string; // prerequisiteSkillNodeId (earlier skill)
  toId: string;   // skillNodeId (later skill)
  kind: ProgressionEdgeKind;
  isExplicit: boolean;
}

// ── Column (Phase) ───────────────────────────────────────────────────────────

export interface ProgressionGraphColumn {
  index: number;
  title: string;
  /** Ordered list of node IDs in this column (domain-then-canonical order). */
  nodeIds: string[];
  isFallback: boolean;
}

// ── Domain Group ─────────────────────────────────────────────────────────────

export interface ProgressionGraphGroup {
  domainId: string;
  domainTitle: string;
  sequenceIndex: number;
  nodeIds: string[];
}

// ── Full graph model ──────────────────────────────────────────────────────────

export interface ProgressionGraph {
  nodes: ProgressionGraphNode[];
  edges: ProgressionGraphEdge[];
  /** Columns ordered left-to-right. */
  columns: ProgressionGraphColumn[];
  /** All domain groups across the graph. */
  groups: ProgressionGraphGroup[];
  diagnostics: CurriculumProgressionDiagnostics;
  hasAnyNodes: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SkillAncestry {
  domainId: string;
  domainTitle: string;
  domainSequenceIndex: number;
  strandId: string | null;
  strandTitle: string | null;
  goalGroupId: string | null;
  goalGroupTitle: string | null;
}

function collectSkillAncestry(
  node: CurriculumTreeNode,
  ancestry: Partial<SkillAncestry>,
  result: Map<string, { node: CurriculumTreeNode; ancestry: SkillAncestry }>,
) {
  const next = { ...ancestry };
  if (node.normalizedType === "domain") {
    next.domainId = node.id;
    next.domainTitle = node.title;
    next.domainSequenceIndex = node.sequenceIndex;
  } else if (node.normalizedType === "strand") {
    next.strandId = node.id;
    next.strandTitle = node.title;
  } else if (node.normalizedType === "goal_group") {
    next.goalGroupId = node.id;
    next.goalGroupTitle = node.title;
  }

  if (node.normalizedType === "skill") {
    result.set(node.id, {
      node,
      ancestry: {
        domainId: next.domainId ?? "unknown",
        domainTitle: next.domainTitle ?? "Unknown Domain",
        domainSequenceIndex: next.domainSequenceIndex ?? 0,
        strandId: next.strandId ?? null,
        strandTitle: next.strandTitle ?? null,
        goalGroupId: next.goalGroupId ?? null,
        goalGroupTitle: next.goalGroupTitle ?? null,
      },
    });
  }

  for (const child of node.children) {
    collectSkillAncestry(child, next, result);
  }
}

function normalizeEdgeKind(raw: string): ProgressionEdgeKind {
  switch (raw) {
    case "hardPrerequisite":
    case "recommendedBefore":
    case "revisitAfter":
    case "coPractice":
    case "inferred":
    case "explicit":
      return raw;
    default:
      return "explicit";
  }
}

// ── Builder ────────────────────────────────────────────────────────────────────

export function buildProgressionGraph(
  tree: CurriculumTree,
  progression: CurriculumProgressionData,
): ProgressionGraph {
  // 1. Collect all skills with their ancestry from the tree.
  const skillMap = new Map<string, { node: CurriculumTreeNode; ancestry: SkillAncestry }>();
  for (const root of tree.rootNodes) {
    collectSkillAncestry(root, {}, skillMap);
  }

  // 2. Build canonical order map (0-based index of each skill in the tree's canonical ordering).
  const canonicalOrderMap = new Map<string, number>();
  tree.canonicalSkillNodeIds.forEach((id, idx) => canonicalOrderMap.set(id, idx));

  // 3. Map each skill to a column via phases.
  const phases = [...progression.phases].sort((a, b) => a.position - b.position);
  const skillToColumnIndex = new Map<string, number>();

  for (const [colIdx, phase] of phases.entries()) {
    for (const skillId of phase.skillNodeIds) {
      if (!skillToColumnIndex.has(skillId)) {
        skillToColumnIndex.set(skillId, colIdx);
      }
    }
  }

  const hasPhasedLayout = phases.length > 0;
  const fallbackColumnIndex = phases.length; // skills with no phase go here

  // 4. Build ProgressionGraphNode list.
  const nodes: ProgressionGraphNode[] = [];
  for (const [skillId, { node, ancestry }] of skillMap.entries()) {
    const colIdx = skillToColumnIndex.get(skillId) ?? fallbackColumnIndex;
    const phaseEntry = hasPhasedLayout ? phases[colIdx] : null;
    nodes.push({
      id: skillId,
      title: node.title,
      columnIndex: colIdx,
      phaseTitle: phaseEntry?.title ?? null,
      isExplicitlyPhased: skillToColumnIndex.has(skillId),
      canonicalOrder: canonicalOrderMap.get(skillId) ?? node.sequenceIndex,
      domainId: ancestry.domainId,
      domainTitle: ancestry.domainTitle,
      strandId: ancestry.strandId,
      strandTitle: ancestry.strandTitle,
      goalGroupId: ancestry.goalGroupId,
      goalGroupTitle: ancestry.goalGroupTitle,
    });
  }

  // 5. Sort nodes within each column: first by domain sequence, then by canonical order.
  const domainOrder = new Map<string, number>();
  for (const n of nodes) {
    if (!domainOrder.has(n.domainId)) {
      const entry = skillMap.get(n.id);
      domainOrder.set(n.domainId, entry?.ancestry.domainSequenceIndex ?? 0);
    }
  }

  nodes.sort((a, b) => {
    if (a.columnIndex !== b.columnIndex) return a.columnIndex - b.columnIndex;
    const domainDiff = (domainOrder.get(a.domainId) ?? 0) - (domainOrder.get(b.domainId) ?? 0);
    if (domainDiff !== 0) return domainDiff;
    return a.canonicalOrder - b.canonicalOrder;
  });

  // 6. Build columns.
  const columnCount = hasPhasedLayout ? phases.length + 1 : 1;
  const columnMap = new Map<number, string[]>();
  for (const node of nodes) {
    const list = columnMap.get(node.columnIndex) ?? [];
    list.push(node.id);
    columnMap.set(node.columnIndex, list);
  }

  const columns: ProgressionGraphColumn[] = [];
  for (let i = 0; i < columnCount; i++) {
    const nodeIds = columnMap.get(i) ?? [];
    if (hasPhasedLayout) {
      if (i < phases.length) {
        columns.push({ index: i, title: phases[i].title, nodeIds, isFallback: false });
      } else if (nodeIds.length > 0) {
        columns.push({ index: i, title: "Unphased", nodeIds, isFallback: true });
      }
    } else {
      columns.push({ index: 0, title: "Canonical Order", nodeIds, isFallback: true });
    }
  }

  // If no phases at all and nothing in the fallback column, still emit one column.
  if (columns.length === 0) {
    columns.push({ index: 0, title: "Canonical Order", nodeIds: [], isFallback: true });
  }

  // 7. Build edges.
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: ProgressionGraphEdge[] = [];
  for (const prereq of progression.prerequisites) {
    if (!nodeIds.has(prereq.skillNodeId) || !nodeIds.has(prereq.prerequisiteSkillNodeId)) continue;
    edges.push({
      fromId: prereq.prerequisiteSkillNodeId,
      toId: prereq.skillNodeId,
      kind: normalizeEdgeKind(prereq.kind),
      isExplicit: prereq.kind !== "inferred",
    });
  }

  // 8. Build domain groups.
  const groupMap = new Map<string, ProgressionGraphGroup>();
  for (const node of nodes) {
    const existing = groupMap.get(node.domainId);
    if (existing) {
      existing.nodeIds.push(node.id);
    } else {
      groupMap.set(node.domainId, {
        domainId: node.domainId,
        domainTitle: node.domainTitle,
        sequenceIndex: domainOrder.get(node.domainId) ?? 0,
        nodeIds: [node.id],
      });
    }
  }
  const groups = [...groupMap.values()].sort((a, b) => a.sequenceIndex - b.sequenceIndex);

  return {
    nodes,
    edges,
    columns,
    groups,
    diagnostics: progression.diagnostics,
    hasAnyNodes: nodes.length > 0,
  };
}
