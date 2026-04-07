/**
 * Semantic validation for curriculum progression graphs.
 *
 * Schema validation (via Zod) is not enough — it only guarantees the shape is
 * correct, not that the references resolve or the graph is acyclic. This module
 * adds a second validation pass that rejects progressions that would silently
 * degrade to inferred-order planning.
 */

import type { CurriculumAiProgression } from "./ai-draft.ts";

export interface ProgressionValidationIssue {
  code:
    | "unresolved_edge_from"
    | "unresolved_edge_to"
    | "self_loop"
    | "duplicate_edge"
    | "hard_prerequisite_cycle"
    | "unresolved_phase_skill"
    | "empty_phases"
    | "low_phase_coverage"
    | "unresolved_skill_id";
  message: string;
  context?: Record<string, unknown>;
}

export interface ProgressionValidationResult {
  valid: boolean;
  issues: ProgressionValidationIssue[];
  summary: {
    skillsInCurriculum: number;
    skillsAssignedToPhases: number;
    edgesAccepted: number;
    edgesDropped: number;
    unresolvedEdgeEndpoints: number;
    unresolvedPhaseSkills: number;
    hardPrerequisiteEdges: number;
    phaseCount: number;
  };
}

/**
 * Validate that a progression graph is semantically meaningful relative to the
 * leaf skill titles extracted from the curriculum document.
 *
 * @param progression - The raw progression from the AI
 * @param leafSkillTitles - The exact normalized titles of all leaf skill nodes
 *   in the curriculum document (from the same normalization pass used for
 *   persistence)
 * @param skillIdToTitle - Optional: map of stable skill ID → title. When provided,
 *   edges and phase members with skillId fields are validated by ID first.
 */
export function validateProgressionSemantics(
  progression: CurriculumAiProgression,
  validSkillRefs: string[],
): ProgressionValidationResult {
  const issues: ProgressionValidationIssue[] = [];
  const skillSet = new Set(validSkillRefs);
  const totalSkills = validSkillRefs.length;

  // --- Edge validation ---
  const edgeSet = new Set<string>();
  let edgesAccepted = 0;
  let edgesDropped = 0;
  let unresolvedEdgeEndpoints = 0;
  let hardPrerequisiteEdges = 0;

  for (const edge of progression.edges) {
    const fromResolved = skillSet.has(edge.fromSkillRef);
    const toResolved = skillSet.has(edge.toSkillRef);

    if (!fromResolved) {
      issues.push({
        code: "unresolved_edge_from",
        message: `Edge fromSkillRef "${edge.fromSkillRef}" does not match any skill in the catalog.`,
        context: { fromSkillRef: edge.fromSkillRef, toSkillRef: edge.toSkillRef, kind: edge.kind },
      });
      unresolvedEdgeEndpoints++;
      edgesDropped++;
      continue;
    }

    if (!toResolved) {
      issues.push({
        code: "unresolved_edge_to",
        message: `Edge toSkillRef "${edge.toSkillRef}" does not match any skill in the catalog.`,
        context: { fromSkillRef: edge.fromSkillRef, toSkillRef: edge.toSkillRef, kind: edge.kind },
      });
      unresolvedEdgeEndpoints++;
      edgesDropped++;
      continue;
    }

    if (edge.fromSkillRef === edge.toSkillRef) {
      issues.push({
        code: "self_loop",
        message: `Self-loop detected: skill "${edge.fromSkillRef}" lists itself as a prerequisite.`,
        context: { skillRef: edge.fromSkillRef, kind: edge.kind },
      });
      edgesDropped++;
      continue;
    }

    const edgeKey = `${edge.fromSkillRef}→${edge.toSkillRef}`;
    if (edgeSet.has(edgeKey)) {
      issues.push({
        code: "duplicate_edge",
        message: `Duplicate edge from "${edge.fromSkillRef}" to "${edge.toSkillRef}".`,
        context: { fromSkillRef: edge.fromSkillRef, toSkillRef: edge.toSkillRef },
      });
      edgesDropped++;
      continue;
    }

    edgeSet.add(edgeKey);
    edgesAccepted++;
    if (edge.kind === "hardPrerequisite") {
      hardPrerequisiteEdges++;
    }
  }

  // --- Hard prerequisite cycle detection ---
  const hardEdges = progression.edges.filter(
    (edge) =>
      edge.kind === "hardPrerequisite" &&
      skillSet.has(edge.fromSkillRef) &&
      skillSet.has(edge.toSkillRef) &&
      edge.fromSkillRef !== edge.toSkillRef,
  );

  const cycleNodes = detectCycles(hardEdges.map((edge) => ({
    from: edge.fromSkillRef,
    to: edge.toSkillRef,
  })));
  if (cycleNodes.length > 0) {
    issues.push({
      code: "hard_prerequisite_cycle",
      message: `Hard prerequisite graph contains a cycle involving: ${cycleNodes.slice(0, 5).join(" → ")}${cycleNodes.length > 5 ? " …" : ""}.`,
      context: { cycleNodes },
    });
  }

  // --- Phase validation ---
  let unresolvedPhaseSkills = 0;
  const assignedSkillRefs = new Set<string>();

  if (progression.phases.length === 0 && totalSkills > 0) {
    issues.push({
      code: "empty_phases",
      message: "Progression has no phases. Every curriculum with skills should have at least one phase.",
    });
  }

  for (const phase of progression.phases) {
    for (const skillRef of phase.skillRefs) {
      if (!skillSet.has(skillRef)) {
        issues.push({
          code: "unresolved_phase_skill",
          message: `Phase "${phase.title}" references skillRef "${skillRef}" which does not match any skill in the catalog.`,
          context: { phaseTitle: phase.title, skillRef },
        });
        unresolvedPhaseSkills++;
      } else {
        assignedSkillRefs.add(skillRef);
      }
    }
  }

  const skillsAssignedToPhases = assignedSkillRefs.size;

  if (totalSkills >= 4 && skillsAssignedToPhases < Math.ceil(totalSkills / 2)) {
    issues.push({
      code: "low_phase_coverage",
      message: `Only ${skillsAssignedToPhases} of ${totalSkills} skills are assigned to phases. At least half should be covered.`,
      context: { skillsAssignedToPhases, totalSkills },
    });
  }

  const valid = issues.every(
    (issue) =>
      issue.code !== "hard_prerequisite_cycle" &&
      issue.code !== "self_loop" &&
      issue.code !== "empty_phases" &&
      issue.code !== "unresolved_skill_id" &&
      issue.code !== "unresolved_phase_skill"
  );

  return {
    valid,
    issues,
    summary: {
      skillsInCurriculum: totalSkills,
      skillsAssignedToPhases,
      edgesAccepted,
      edgesDropped,
      unresolvedEdgeEndpoints,
      unresolvedPhaseSkills,
      hardPrerequisiteEdges,
      phaseCount: progression.phases.length,
    },
  };
}

/**
 * Returns the nodes involved in the first cycle found, or empty array if acyclic.
 * Uses iterative DFS with three-color marking.
 */
function detectCycles(edges: { from: string; to: string }[]): string[] {
  const adjacency = new Map<string, string[]>();
  for (const { from, to } of edges) {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(to);
    if (!adjacency.has(to)) adjacency.set(to, []);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const node of adjacency.keys()) {
    color.set(node, WHITE);
  }

  function dfs(start: string): string[] {
    const stack: Array<{ node: string; iterating: boolean }> = [{ node: start, iterating: false }];

    while (stack.length > 0) {
      const top = stack[stack.length - 1];

      if (!top.iterating) {
        if (color.get(top.node) === BLACK) {
          stack.pop();
          continue;
        }
        if (color.get(top.node) === GRAY) {
          // Found cycle — reconstruct path
          const cyclePath: string[] = [top.node];
          let curr: string | null | undefined = parent.get(top.node);
          while (curr && curr !== top.node) {
            cyclePath.unshift(curr);
            curr = parent.get(curr);
          }
          cyclePath.unshift(top.node);
          return cyclePath;
        }
        color.set(top.node, GRAY);
        top.iterating = true;
      }

      const neighbors = adjacency.get(top.node) ?? [];
      let pushed = false;
      for (const neighbor of neighbors) {
        if (color.get(neighbor) === WHITE) {
          parent.set(neighbor, top.node);
          stack.push({ node: neighbor, iterating: false });
          pushed = true;
          break;
        } else if (color.get(neighbor) === GRAY) {
          const cyclePath: string[] = [neighbor];
          let curr: string | null | undefined = top.node;
          while (curr && curr !== neighbor) {
            cyclePath.unshift(curr);
            curr = parent.get(curr);
          }
          cyclePath.unshift(neighbor);
          return cyclePath;
        }
      }

      if (!pushed) {
        color.set(top.node, BLACK);
        stack.pop();
      }
    }

    return [];
  }

  for (const node of adjacency.keys()) {
    if (color.get(node) === WHITE) {
      const cycle = dfs(node);
      if (cycle.length > 0) return cycle;
    }
  }

  return [];
}

/**
 * Extract leaf skill titles from a curriculum document tree.
 * Mirrors the logic in normalization.ts so validation uses the same title set.
 */
export function extractLeafSkillTitles(
  document: Record<string, unknown>,
): string[] {
  const titles: string[] = [];
  collectLeafTitles(document, titles);
  return titles;
}

function collectLeafTitles(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    const trimmed = node.trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed) out.push(trimmed);
      }
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (typeof value === "string") {
        // keyed string → the key is the skill title
        const trimmed = key.trim();
        if (trimmed) out.push(trimmed);
      } else {
        collectLeafTitles(value, out);
      }
    }
  }
}
