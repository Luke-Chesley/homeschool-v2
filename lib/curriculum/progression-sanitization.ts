/**
 * Narrow, deterministic ref sanitization for progression drafts.
 *
 * Before declaring a semantic failure, this pass corrects obvious local-model
 * mistakes such as double-prefix corruption (cnode_cnode_x → cnode_x) and
 * whitespace. It does NOT do fuzzy matching by title or guess arbitrary IDs.
 *
 * Every sanitization change is recorded so the caller can audit what was
 * corrected and whether the sanitization was productive.
 */

import type { CurriculumAiProgression } from "./ai-draft.ts";

export interface RefSanitizationResult {
  originalRef: string;
  sanitizedRef: string;
  changed: boolean;
}

/**
 * Sanitize a single skill ref.
 * Rules (applied in order, all auditable):
 * 1. Trim leading/trailing whitespace.
 * 2. Collapse accidental double-prefix: `cnode_cnode_x` → `cnode_x`,
 *    `skill_skill_x` → `skill_x`, `node_node_x` → `node_x`.
 */
export function sanitizeSkillRef(ref: string): RefSanitizationResult {
  const originalRef = ref;
  let sanitized = ref.trim();

  // Collapse double prefix for known ID prefixes.
  // Pattern: <prefix>_<prefix>_<rest> → <prefix>_<rest>
  sanitized = sanitized.replace(/^(cnode|skill|node)_\1_/, "$1_");

  return {
    originalRef,
    sanitizedRef: sanitized,
    changed: sanitized !== originalRef,
  };
}

export interface ProgressionSanitizationReport {
  sanitized: CurriculumAiProgression;
  results: RefSanitizationResult[];
  anyChanged: boolean;
}

/**
 * Apply sanitization to all skill refs in a progression draft (phases + edges).
 * Returns the sanitized progression and a full audit report.
 */
export function sanitizeProgressionRefs(
  progression: CurriculumAiProgression,
): ProgressionSanitizationReport {
  const results: RefSanitizationResult[] = [];

  const sanitizedPhases = progression.phases.map((phase) => {
    const sanitizedRefs = phase.skillRefs.map((ref) => {
      const r = sanitizeSkillRef(ref);
      results.push(r);
      return r.sanitizedRef;
    });
    return { ...phase, skillRefs: sanitizedRefs };
  });

  const sanitizedEdges = progression.edges.map((edge) => {
    const fromResult = sanitizeSkillRef(edge.fromSkillRef);
    const toResult = sanitizeSkillRef(edge.toSkillRef);
    results.push(fromResult, toResult);
    return {
      ...edge,
      fromSkillRef: fromResult.sanitizedRef,
      toSkillRef: toResult.sanitizedRef,
    };
  });

  const anyChanged = results.some((r) => r.changed);

  return {
    sanitized: { phases: sanitizedPhases, edges: sanitizedEdges },
    results,
    anyChanged,
  };
}
