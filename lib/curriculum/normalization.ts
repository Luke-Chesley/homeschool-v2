import { createHash } from "node:crypto";

import type { CurriculumNodeType } from "@/lib/curriculum/types";
import { normalizeCurriculumLabel } from "./labels.ts";
import type { CurriculumAiProgression } from "./ai-draft.ts";

type CurriculumJsonNode =
  | string
  | string[]
  | {
      [key: string]: CurriculumJsonNode;
    };

interface LeafDraft {
  title: string;
  description?: string;
  rawPath: string[];
  rawContainerPath: string[];
  sequenceIndex: number;
  sourcePayload: Record<string, unknown>;
}

interface NodeAccumulator {
  id: string;
  sourceId: string;
  parentNodeId: string | null;
  normalizedType: CurriculumNodeType;
  title: string;
  code: string | null;
  description: string | null;
  sequenceIndex: number;
  depth: number;
  normalizedPath: string;
  originalLabel: string | null;
  originalType: string | null;
  estimatedMinutes: number | null;
  isActive: boolean;
  sourcePayload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

type PrerequisiteKind = "explicit" | "inferred" | "hardPrerequisite" | "recommendedBefore" | "revisitAfter" | "coPractice";

export interface NormalizedCurriculumImport {
  nodes: NodeAccumulator[];
  prerequisites: Array<{
    sourceId: string;
    skillNodeId: string;
    prerequisiteSkillNodeId: string;
    kind: PrerequisiteKind;
    metadata: Record<string, unknown>;
  }>;
  phases: Array<{
    sourceId: string;
    title: string;
    description?: string;
    position: number;
    nodeIds: string[];
  }>;
  summary: {
    nodeCount: number;
    skillCount: number;
    maxDepth: number;
    sourceFingerprint: string;
    progressionDiagnostics: {
      hasExplicitProgression: boolean;
      usingInferredFallback: boolean;
      phaseCount: number;
      acceptedEdgeCount: number;
      droppedEdgeCount: number;
      unmatchedPhaseSkillCount: number;
    };
  };
}

const SYNTHETIC_STRAND_LABEL = "General";
const SYNTHETIC_GOAL_GROUP_LABEL = "Skills";
const SYNTHETIC_DOMAIN_LABEL = "Imported Curriculum";

function cleanLabel(value: string) {
  return normalizeCurriculumLabel(value);
}

function slugify(value: string) {
  return cleanLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "node";
}

function stableNodeId(sourceLineageId: string, normalizedType: CurriculumNodeType, normalizedPath: string) {
  const hash = createHash("sha256")
    .update(`${sourceLineageId}:${normalizedType}:${normalizedPath}`)
    .digest("hex")
    .slice(0, 24);

  return `cnode_${hash}`;
}

function fingerprintDocument(document: Record<string, CurriculumJsonNode>) {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function maybeExtractCode(value: string) {
  const match = value.match(/^([A-Za-z0-9][A-Za-z0-9.-]{1,20})\s+/);
  return match?.[1] ?? null;
}

function normalizeRolePath(rawContainerPath: string[]) {
  const cleaned = rawContainerPath.map(cleanLabel).filter(Boolean);

  if (cleaned.length === 0) {
    return {
      domain: { title: SYNTHETIC_DOMAIN_LABEL, originalLabel: null, synthesized: true },
      strand: { title: SYNTHETIC_STRAND_LABEL, originalLabel: null, synthesized: true },
      goalGroup: { title: SYNTHETIC_GOAL_GROUP_LABEL, originalLabel: null, synthesized: true },
      compressedSegments: [] as string[],
    };
  }

  if (cleaned.length === 1) {
    return {
      domain: { title: cleaned[0], originalLabel: rawContainerPath[0] ?? cleaned[0], synthesized: false },
      strand: { title: SYNTHETIC_STRAND_LABEL, originalLabel: null, synthesized: true },
      goalGroup: { title: SYNTHETIC_GOAL_GROUP_LABEL, originalLabel: null, synthesized: true },
      compressedSegments: [] as string[],
    };
  }

  if (cleaned.length === 2) {
    return {
      domain: { title: cleaned[0], originalLabel: rawContainerPath[0] ?? cleaned[0], synthesized: false },
      strand: { title: cleaned[1], originalLabel: rawContainerPath[1] ?? cleaned[1], synthesized: false },
      goalGroup: { title: SYNTHETIC_GOAL_GROUP_LABEL, originalLabel: null, synthesized: true },
      compressedSegments: [] as string[],
    };
  }

  if (cleaned.length === 3) {
    return {
      domain: { title: cleaned[0], originalLabel: rawContainerPath[0] ?? cleaned[0], synthesized: false },
      strand: { title: cleaned[1], originalLabel: rawContainerPath[1] ?? cleaned[1], synthesized: false },
      goalGroup: { title: cleaned[2], originalLabel: rawContainerPath[2] ?? cleaned[2], synthesized: false },
      compressedSegments: [] as string[],
    };
  }

  const compressed = cleaned.slice(2);
  return {
    domain: { title: cleaned[0], originalLabel: rawContainerPath[0] ?? cleaned[0], synthesized: false },
    strand: { title: cleaned[1], originalLabel: rawContainerPath[1] ?? cleaned[1], synthesized: false },
    goalGroup: {
      title: compressed.join(" / "),
      originalLabel: rawContainerPath.slice(2).join(" / "),
      synthesized: false,
    },
    compressedSegments: rawContainerPath.slice(2),
  };
}

function collectLeaves(
  node: CurriculumJsonNode,
  pathSegments: string[] = [],
  leaves: LeafDraft[] = [],
): LeafDraft[] {
  if (typeof node === "string") {
    const title = node.trim();
    if (title) {
        leaves.push({
          title,
          rawPath: [...pathSegments, title],
          rawContainerPath: pathSegments,
          sequenceIndex: leaves.length,
          sourcePayload: {
            leafKind: "string",
            rawValue: node,
            rawPath: [...pathSegments, title],
            rawContainerPath: pathSegments,
            rawDepth: pathSegments.length,
          },
        });
    }
    return leaves;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const title = item.trim();
      if (!title) continue;
      leaves.push({
        title,
        rawPath: [...pathSegments, title],
        rawContainerPath: pathSegments,
        sequenceIndex: leaves.length,
        sourcePayload: {
          leafKind: "array_item",
          rawValue: item,
          rawPath: [...pathSegments, title],
          rawContainerPath: pathSegments,
          rawDepth: pathSegments.length,
        },
      });
    }
    return leaves;
  }

  for (const [key, value] of Object.entries(node)) {
    const cleanedKey = cleanLabel(key);
    if (!cleanedKey) {
      continue;
    }

    if (typeof value === "string") {
      const description = value.trim() || undefined;
      leaves.push({
        title: cleanedKey,
        description,
        rawPath: [...pathSegments, key],
        rawContainerPath: pathSegments,
        sequenceIndex: leaves.length,
        sourcePayload: {
          leafKind: "keyed_string",
          rawValue: value,
          rawKey: key,
          rawPath: [...pathSegments, key],
          rawContainerPath: pathSegments,
          rawDepth: pathSegments.length,
        },
      });
      continue;
    }

    collectLeaves(value, [...pathSegments, key], leaves);
  }

  return leaves;
}

export function normalizeCurriculumDocument(args: {
  sourceId: string;
  sourceLineageId: string;
  document: Record<string, CurriculumJsonNode>;
  progression?: CurriculumAiProgression;
}): NormalizedCurriculumImport {
  const leaves = collectLeaves(args.document);
  const nodes = new Map<string, NodeAccumulator>();
  const siblingCounters = new Map<string, number>();
  const canonicalSkillNodeIds: string[] = [];

  // Diagnostic counters populated below
  let _droppedEdgeCount = 0;
  let _unmatchedPhaseSkillCount = 0;
  let _usingInferredFallback = false;

  const createOrGetNode = (params: {
    normalizedType: CurriculumNodeType;
    title: string;
    parentNodeId: string | null;
    parentPath: string | null;
    originalLabel: string | null;
    originalType: string | null;
    sourcePayload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) => {
    const slug = `${params.normalizedType}:${slugify(params.title)}`;
    const normalizedPath = params.parentPath ? `${params.parentPath}/${slug}` : slug;
    const existing = nodes.get(normalizedPath);
    if (existing) {
      return existing;
    }

    const siblingKey = params.parentNodeId ?? "__root__";
    const sequenceIndex = siblingCounters.get(siblingKey) ?? 0;
    siblingCounters.set(siblingKey, sequenceIndex + 1);

    const node: NodeAccumulator = {
      id: stableNodeId(args.sourceLineageId, params.normalizedType, normalizedPath),
      sourceId: args.sourceId,
      parentNodeId: params.parentNodeId,
      normalizedType: params.normalizedType,
      title: params.title,
      code: params.normalizedType === "skill" ? maybeExtractCode(params.title) : null,
      description: null,
      sequenceIndex,
      depth: normalizedPath.split("/").length - 1,
      normalizedPath,
      originalLabel: params.originalLabel,
      originalType: params.originalType,
      estimatedMinutes: null,
      isActive: true,
      sourcePayload: params.sourcePayload ?? {},
      metadata: params.metadata ?? {},
    };

    nodes.set(normalizedPath, node);
    return node;
  };

  for (const leaf of leaves) {
    const rolePath = normalizeRolePath(leaf.rawContainerPath);

    const domainNode = createOrGetNode({
      normalizedType: "domain",
      title: rolePath.domain.title,
      parentNodeId: null,
      parentPath: null,
      originalLabel: rolePath.domain.originalLabel,
      originalType: rolePath.domain.synthesized ? "synthetic" : "source_container",
      sourcePayload: {
        nodeRole: "domain",
        rawContainerPath: leaf.rawContainerPath,
        rawPath: leaf.rawPath,
        sourceLineage: leaf.rawContainerPath.slice(0, 1),
        synthesized: rolePath.domain.synthesized,
      },
      metadata: {
        rawContainerPath: leaf.rawContainerPath,
        rawPath: leaf.rawPath,
        sourceLineage: leaf.rawContainerPath.slice(0, 1),
        synthesized: rolePath.domain.synthesized,
      },
    });

    const strandNode = createOrGetNode({
      normalizedType: "strand",
      title: rolePath.strand.title,
      parentNodeId: domainNode.id,
      parentPath: domainNode.normalizedPath,
      originalLabel: rolePath.strand.originalLabel,
      originalType: rolePath.strand.synthesized ? "synthetic" : "source_container",
      sourcePayload: {
        nodeRole: "strand",
        rawContainerPath: leaf.rawContainerPath,
        rawPath: leaf.rawPath,
        sourceLineage: leaf.rawContainerPath.slice(0, 2),
        synthesized: rolePath.strand.synthesized,
      },
      metadata: {
        rawContainerPath: leaf.rawContainerPath,
        rawPath: leaf.rawPath,
        sourceLineage: leaf.rawContainerPath.slice(0, 2),
        synthesized: rolePath.strand.synthesized,
      },
    });

    const goalGroupNode = createOrGetNode({
      normalizedType: "goal_group",
      title: rolePath.goalGroup.title,
      parentNodeId: strandNode.id,
      parentPath: strandNode.normalizedPath,
      originalLabel: rolePath.goalGroup.originalLabel,
      originalType: rolePath.goalGroup.synthesized ? "synthetic" : "source_container",
      sourcePayload: {
        nodeRole: "goal_group",
        rawContainerPath: leaf.rawContainerPath,
        rawPath: leaf.rawPath,
        sourceLineage: leaf.rawPath.slice(0, 3),
        synthesized: rolePath.goalGroup.synthesized,
        ...(rolePath.compressedSegments.length > 0
          ? {
              compressedStructure: {
                compressedTitle: rolePath.goalGroup.title,
                rawPath: leaf.rawPath,
                rawContainerPath: leaf.rawContainerPath,
                compressedSegments: rolePath.compressedSegments,
              },
            }
          : {}),
      },
      metadata: {
        rawContainerPath: leaf.rawContainerPath,
        rawPath: leaf.rawPath,
        sourceLineage: leaf.rawPath.slice(0, 3),
        synthesized: rolePath.goalGroup.synthesized,
        compressedSegments: rolePath.compressedSegments,
        compressedStructure:
          rolePath.compressedSegments.length > 0
            ? {
                compressedTitle: rolePath.goalGroup.title,
                rawPath: leaf.rawPath,
                rawContainerPath: leaf.rawContainerPath,
                compressedSegments: rolePath.compressedSegments,
              }
            : null,
      },
    });

    const skillNode = createOrGetNode({
      normalizedType: "skill",
      title: cleanLabel(leaf.title),
      parentNodeId: goalGroupNode.id,
      parentPath: goalGroupNode.normalizedPath,
      originalLabel: leaf.title,
      originalType: "source_leaf",
      sourcePayload: leaf.sourcePayload,
      metadata: {
        rawPath: leaf.rawPath,
        rawContainerPath: leaf.rawContainerPath,
        sourceLineage: leaf.rawPath.slice(0, -1),
        canonicalSequenceIndex: leaf.sequenceIndex,
      },
    });

    skillNode.description = leaf.description ?? skillNode.description;
    canonicalSkillNodeIds.push(skillNode.id);
  }

  const skillIdByTitle = new Map<string, string>();
  for (const node of nodes.values()) {
    if (node.normalizedType === "skill") {
      skillIdByTitle.set(node.title, node.id);
    }
  }

  const prerequisites: NormalizedCurriculumImport["prerequisites"] = [];

  // Build a set of valid node IDs for ID-first resolution
  const validNodeIds = new Set<string>();
  for (const node of nodes.values()) {
    if (node.normalizedType === "skill") {
      validNodeIds.add(node.id);
    }
  }

  if (args.progression?.edges && args.progression.edges.length > 0) {
    const unmatchedEdgeEndpoints: Array<{ fromSkillTitle: string; toSkillTitle: string; unresolved: string[] }> = [];

    for (const edge of args.progression.edges) {
      // Resolve by stable ID first (new path), fall back to title lookup (legacy path)
      const skillNodeId = (edge.toSkillId && validNodeIds.has(edge.toSkillId))
        ? edge.toSkillId
        : skillIdByTitle.get(edge.toSkillTitle);
      const prerequisiteSkillNodeId = (edge.fromSkillId && validNodeIds.has(edge.fromSkillId))
        ? edge.fromSkillId
        : skillIdByTitle.get(edge.fromSkillTitle);

      if (skillNodeId && prerequisiteSkillNodeId) {
        prerequisites.push({
          sourceId: args.sourceId,
          skillNodeId,
          prerequisiteSkillNodeId,
          kind: edge.kind,
          metadata: {
            derivedFrom: "explicit_progression_graph",
            resolvedById: Boolean(edge.toSkillId && validNodeIds.has(edge.toSkillId)),
          },
        });
      } else {
        const unresolved: string[] = [];
        if (!prerequisiteSkillNodeId) unresolved.push(`fromSkillTitle: "${edge.fromSkillTitle}"`);
        if (!skillNodeId) unresolved.push(`toSkillTitle: "${edge.toSkillTitle}"`);
        unmatchedEdgeEndpoints.push({ fromSkillTitle: edge.fromSkillTitle, toSkillTitle: edge.toSkillTitle, unresolved });
      }
    }

    _droppedEdgeCount = unmatchedEdgeEndpoints.length;

    if (unmatchedEdgeEndpoints.length > 0) {
      console.error("[curriculum/normalization] Progression edges dropped due to unmatched skill titles.", {
        sourceId: args.sourceId,
        droppedEdgeCount: unmatchedEdgeEndpoints.length,
        totalEdgeCount: args.progression.edges.length,
        acceptedEdgeCount: prerequisites.length,
        unmatchedEdges: unmatchedEdgeEndpoints.slice(0, 10),
        availableSkillTitles: [...skillIdByTitle.keys()].slice(0, 20),
      });
    } else {
      console.info("[curriculum/normalization] All progression edges resolved.", {
        sourceId: args.sourceId,
        acceptedEdgeCount: prerequisites.length,
      });
    }
  } else {
    // Explicit fallback: inferred sequence — log clearly so it is observable
    _usingInferredFallback = true;
    console.info("[curriculum/normalization] No explicit progression edges — using inferred canonical order fallback.", {
      sourceId: args.sourceId,
      hasProgression: Boolean(args.progression),
      hasEdges: Boolean(args.progression?.edges),
      edgeCount: args.progression?.edges?.length ?? 0,
      skillCount: canonicalSkillNodeIds.length,
    });

    for (let i = 1; i < canonicalSkillNodeIds.length; i++) {
      prerequisites.push({
        sourceId: args.sourceId,
        skillNodeId: canonicalSkillNodeIds[i],
        prerequisiteSkillNodeId: canonicalSkillNodeIds[i - 1],
        kind: "inferred",
        metadata: {
          derivedFrom: "canonical_skill_sequence",
          predecessorIndex: i - 1,
        },
      });
    }
  }

  const phases: NormalizedCurriculumImport["phases"] = [];
  if (args.progression?.phases && args.progression.phases.length > 0) {
    const unmatchedPhaseSkills: Array<{ phaseTitle: string; skillTitle: string }> = [];

    for (const [index, phase] of args.progression.phases.entries()) {
      const nodeIds: string[] = [];
      for (let i = 0; i < phase.skillTitles.length; i++) {
        const title = phase.skillTitles[i];
        const skillId = phase.skillIds?.[i];
        // Resolve by stable ID first, fall back to title lookup
        const nodeId = (skillId && validNodeIds.has(skillId))
          ? skillId
          : skillIdByTitle.get(title);
        if (nodeId) {
          nodeIds.push(nodeId);
        } else {
          unmatchedPhaseSkills.push({ phaseTitle: phase.title, skillTitle: title });
        }
      }
      phases.push({
        sourceId: args.sourceId,
        title: phase.title,
        description: phase.description,
        position: index,
        nodeIds,
      });
    }

    _unmatchedPhaseSkillCount = unmatchedPhaseSkills.length;

    if (unmatchedPhaseSkills.length > 0) {
      console.error("[curriculum/normalization] Phase skill titles dropped due to unmatched titles.", {
        sourceId: args.sourceId,
        droppedCount: unmatchedPhaseSkills.length,
        unmatchedPhaseSkills: unmatchedPhaseSkills.slice(0, 10),
      });
    }

    console.info("[curriculum/normalization] Phases normalized.", {
      sourceId: args.sourceId,
      phaseCount: phases.length,
      totalPhaseNodeAssignments: phases.reduce((sum, phase) => sum + phase.nodeIds.length, 0),
      unmatchedSkillCount: unmatchedPhaseSkills.length,
    });
  }

  return {
    nodes: [...nodes.values()].sort((left, right) => {
      if (left.depth !== right.depth) {
        return left.depth - right.depth;
      }
      if (left.parentNodeId !== right.parentNodeId) {
        return (left.parentNodeId ?? "").localeCompare(right.parentNodeId ?? "");
      }
      return left.sequenceIndex - right.sequenceIndex;
    }),
    prerequisites,
    phases,
    summary: {
      nodeCount: nodes.size,
      skillCount: canonicalSkillNodeIds.length,
      maxDepth: Math.max(0, ...[...nodes.values()].map((node) => node.depth)),
      sourceFingerprint: fingerprintDocument(args.document),
      progressionDiagnostics: {
        hasExplicitProgression: Boolean(args.progression?.edges?.length || args.progression?.phases?.length),
        usingInferredFallback: _usingInferredFallback,
        phaseCount: phases.length,
        acceptedEdgeCount: prerequisites.filter((p) => p.metadata?.derivedFrom === "explicit_progression_graph").length,
        droppedEdgeCount: _droppedEdgeCount,
        unmatchedPhaseSkillCount: _unmatchedPhaseSkillCount,
      },
    },
  };
}
