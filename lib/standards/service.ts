/**
 * Standards service — browsing and mapping helpers.
 *
 * Uses in-memory fixture data. Integration point: replace with a real
 * repository once plan 02 is merged.
 */

import { FRAMEWORKS, STANDARDS } from "./fixtures";
import type {
  StandardsFramework,
  Standard,
  CustomGoal,
  StandardsSearchParams,
  CreateCustomGoalInput,
} from "./types";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Frameworks
// ---------------------------------------------------------------------------

export function listFrameworks(): StandardsFramework[] {
  return FRAMEWORKS;
}

export function getFramework(id: string): StandardsFramework | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

// ---------------------------------------------------------------------------
// Standards browsing
// ---------------------------------------------------------------------------

export function listStandards(params: StandardsSearchParams = {}): Standard[] {
  let results = STANDARDS;

  if (params.frameworkId) {
    results = results.filter((s) => s.frameworkId === params.frameworkId);
  }
  if (params.subject) {
    results = results.filter((s) => s.subject === params.subject);
  }
  if (params.gradeLevel) {
    results = results.filter((s) => s.gradeLevel === params.gradeLevel);
  }
  if (params.parentId !== undefined) {
    results = results.filter((s) =>
      params.parentId === null ? !s.parentId : s.parentId === params.parentId
    );
  }
  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
    );
  }

  return results;
}

export function getStandard(id: string): Standard | undefined {
  return STANDARDS.find((s) => s.id === id);
}

/**
 * Returns the children of a given standard node (one level down).
 */
export function getStandardChildren(parentId: string): Standard[] {
  return STANDARDS.filter((s) => s.parentId === parentId);
}

/**
 * Returns ancestor chain for a standard, ordered from root to node.
 */
export function getStandardBreadcrumbs(id: string): Standard[] {
  const breadcrumbs: Standard[] = [];
  let current = getStandard(id);
  while (current) {
    breadcrumbs.unshift(current);
    current = current.parentId ? getStandard(current.parentId) : undefined;
  }
  return breadcrumbs;
}

// ---------------------------------------------------------------------------
// Custom goals (in-memory store)
// ---------------------------------------------------------------------------

const customGoals = new Map<string, CustomGoal>();

export function listCustomGoals(householdId: string): CustomGoal[] {
  return [...customGoals.values()].filter((g) => g.householdId === householdId);
}

export function createCustomGoal(input: CreateCustomGoalInput): CustomGoal {
  const now = new Date().toISOString();
  const goal: CustomGoal = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  customGoals.set(goal.id, goal);
  return goal;
}

export function deleteCustomGoal(id: string): void {
  customGoals.delete(id);
}

// ---------------------------------------------------------------------------
// Standards suggestion helper (integration point for plan 08 AI tasks)
// ---------------------------------------------------------------------------

/**
 * Returns standards that may be relevant to an objective description.
 *
 * Stub implementation does simple keyword matching.
 * Integration point: replace with a vector-similarity call (plan 08).
 */
export function suggestStandards(
  objectiveText: string,
  params: Pick<StandardsSearchParams, "frameworkId" | "gradeLevel" | "subject"> = {}
): Standard[] {
  const keywords = objectiveText
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const candidates = listStandards({ ...params });

  return candidates
    .map((s) => {
      const text = `${s.code} ${s.title} ${s.description ?? ""}`.toLowerCase();
      const score = keywords.filter((k) => text.includes(k)).length;
      return { standard: s, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.standard);
}
