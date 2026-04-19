/**
 * Tests for progression regeneration resolution logic.
 *
 * Covers the regression where normalizeCurriculumDocument() was called with a
 * fake synthetic document, causing all skillRef resolution to fail against
 * the wrong node ID universe — producing empty phases and no prerequisites
 * while still marking progression as explicit_ready.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveProgressionAgainstExistingNodes,
} from "../lib/curriculum/progression-regeneration.ts";
import type { CurriculumAiProgression } from "../lib/curriculum/ai-draft.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDbSkillNodes() {
  return [
    { id: "cnode_abc001", title: "Board Setup" },
    { id: "cnode_abc002", title: "Piece Movement" },
    { id: "cnode_abc003", title: "Check and Checkmate" },
    { id: "cnode_abc004", title: "Opening Principles" },
    { id: "cnode_abc005", title: "Tactical Patterns" },
  ];
}

function makeProgressionWithRealIds(): CurriculumAiProgression {
  return {
    phases: [
      {
        title: "Phase 1: Foundations",
        skillRefs: ["cnode_abc001", "cnode_abc002"],
      },
      {
        title: "Phase 2: Core Concepts",
        skillRefs: ["cnode_abc003", "cnode_abc004"],
      },
      {
        title: "Phase 3: Tactics",
        skillRefs: ["cnode_abc005"],
      },
    ],
    edges: [
      { fromSkillRef: "cnode_abc001", toSkillRef: "cnode_abc002", kind: "hardPrerequisite" },
      { fromSkillRef: "cnode_abc002", toSkillRef: "cnode_abc003", kind: "hardPrerequisite" },
      { fromSkillRef: "cnode_abc003", toSkillRef: "cnode_abc005", kind: "recommendedBefore" },
    ],
  };
}

// ── Happy-path resolution tests ───────────────────────────────────────────────

test("resolveProgressionAgainstExistingNodes: resolves all phases when skillRefs match DB ids", () => {
  const nodes = makeDbSkillNodes();
  const progression = makeProgressionWithRealIds();

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.equal(result.resolvedPhases.length, 3);
  assert.equal(result.diagnostics.totalAssignedSkillRefs, 5);
  assert.equal(result.diagnostics.unresolvedSkillRefCount, 0);
  assert.equal(result.diagnostics.emptyPhaseCount, 0);
});

test("resolveProgressionAgainstExistingNodes: persists phase nodeIds as real DB ids", () => {
  const nodes = makeDbSkillNodes();
  const progression = makeProgressionWithRealIds();

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.deepEqual(result.resolvedPhases[0].nodeIds, ["cnode_abc001", "cnode_abc002"]);
  assert.deepEqual(result.resolvedPhases[1].nodeIds, ["cnode_abc003", "cnode_abc004"]);
  assert.deepEqual(result.resolvedPhases[2].nodeIds, ["cnode_abc005"]);
});

test("resolveProgressionAgainstExistingNodes: resolves explicit prerequisites", () => {
  const nodes = makeDbSkillNodes();
  const progression = makeProgressionWithRealIds();

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.equal(result.resolvedPrerequisites.length, 3);
  assert.equal(result.diagnostics.totalAcceptedEdges, 3);
  assert.equal(result.diagnostics.droppedEdgeCount, 0);
});

test("resolveProgressionAgainstExistingNodes: prerequisite direction is (to, from)", () => {
  const nodes = makeDbSkillNodes();
  const progression = makeProgressionWithRealIds();

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  // edge: from=cnode_abc001 → to=cnode_abc002 means abc002 requires abc001
  const firstPrereq = result.resolvedPrerequisites[0];
  assert.equal(firstPrereq.skillNodeId, "cnode_abc002");
  assert.equal(firstPrereq.prerequisiteSkillNodeId, "cnode_abc001");
  assert.equal(firstPrereq.kind, "hardPrerequisite");
});

// ── Regression test: synthetic-doc normalization failure ──────────────────────

test("regression: all-fail resolution when skillRefs are fake synthetic ids (not DB ids)", () => {
  // This is the exact regression: the model output uses real DB IDs but the
  // old code resolved against a synthetically-generated node ID universe,
  // so everything dropped silently.
  const nodes = makeDbSkillNodes();

  // Simulate model output that uses fake/wrong IDs (as happened before the fix)
  const progressionWithFakeIds: CurriculumAiProgression = {
    phases: [
      {
        title: "Phase 1",
        skillRefs: ["synthetic_cnode_aaaa", "synthetic_cnode_bbbb"],
      },
    ],
    edges: [
      {
        fromSkillRef: "synthetic_cnode_aaaa",
        toSkillRef: "synthetic_cnode_bbbb",
        kind: "hardPrerequisite",
      },
    ],
  };

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progressionWithFakeIds);

  // All refs fail to resolve
  assert.equal(result.diagnostics.totalAssignedSkillRefs, 0);
  assert.equal(result.diagnostics.unresolvedSkillRefCount, 2);
  assert.equal(result.diagnostics.emptyPhaseCount, 1);
  assert.equal(result.diagnostics.droppedEdgeCount, 1);

  // Phase rows are created but have zero nodeIds
  assert.equal(result.resolvedPhases.length, 1);
  assert.equal(result.resolvedPhases[0].nodeIds.length, 0);

  // No prerequisites
  assert.equal(result.resolvedPrerequisites.length, 0);
});

// ── Partial resolution tests ──────────────────────────────────────────────────

test("resolveProgressionAgainstExistingNodes: partial resolution drops only unresolvable refs", () => {
  const nodes = makeDbSkillNodes();

  const progression: CurriculumAiProgression = {
    phases: [
      {
        title: "Phase 1",
        skillRefs: ["cnode_abc001", "bad_ref_xyz", "cnode_abc002"],
      },
    ],
    edges: [
      { fromSkillRef: "cnode_abc001", toSkillRef: "cnode_abc002", kind: "hardPrerequisite" },
      { fromSkillRef: "bad_ref_xyz", toSkillRef: "cnode_abc002", kind: "hardPrerequisite" },
    ],
  };

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  // Only 2 of 3 phase refs resolve
  assert.equal(result.resolvedPhases[0].nodeIds.length, 2);
  assert.deepEqual(result.resolvedPhases[0].nodeIds, ["cnode_abc001", "cnode_abc002"]);
  assert.equal(result.diagnostics.unresolvedSkillRefCount, 1);

  // Only 1 of 2 edges resolves
  assert.equal(result.resolvedPrerequisites.length, 1);
  assert.equal(result.diagnostics.droppedEdgeCount, 1);
  assert.equal(result.diagnostics.totalAssignedSkillRefs, 2);
});

// ── Edge deduplication / self-loop ────────────────────────────────────────────

test("resolveProgressionAgainstExistingNodes: drops self-loop edges", () => {
  const nodes = makeDbSkillNodes();

  const progression: CurriculumAiProgression = {
    phases: [{ title: "P1", skillRefs: ["cnode_abc001"] }],
    edges: [
      { fromSkillRef: "cnode_abc001", toSkillRef: "cnode_abc001", kind: "hardPrerequisite" },
    ],
  };

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.equal(result.resolvedPrerequisites.length, 0);
  assert.equal(result.diagnostics.droppedEdgeCount, 1);
});

test("resolveProgressionAgainstExistingNodes: drops duplicate edges", () => {
  const nodes = makeDbSkillNodes();

  const progression: CurriculumAiProgression = {
    phases: [{ title: "P1", skillRefs: ["cnode_abc001", "cnode_abc002"] }],
    edges: [
      { fromSkillRef: "cnode_abc001", toSkillRef: "cnode_abc002", kind: "hardPrerequisite" },
      { fromSkillRef: "cnode_abc001", toSkillRef: "cnode_abc002", kind: "hardPrerequisite" },
    ],
  };

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.equal(result.resolvedPrerequisites.length, 1);
  assert.equal(result.diagnostics.droppedEdgeCount, 1);
});

// ── Empty inputs ──────────────────────────────────────────────────────────────

test("resolveProgressionAgainstExistingNodes: empty phases produces zero membership count", () => {
  const nodes = makeDbSkillNodes();

  const progression: CurriculumAiProgression = {
    phases: [],
    edges: [],
  };

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.equal(result.resolvedPhases.length, 0);
  assert.equal(result.diagnostics.totalAssignedSkillRefs, 0);
  assert.equal(result.diagnostics.emptyPhaseCount, 0);
  assert.equal(result.resolvedPrerequisites.length, 0);
});

// ── Integrity check inputs ────────────────────────────────────────────────────

test("resolveProgressionAgainstExistingNodes: emptyPhaseCount reflects phases with zero nodeIds", () => {
  const nodes = makeDbSkillNodes();

  const progression: CurriculumAiProgression = {
    phases: [
      { title: "Empty Phase", skillRefs: ["bad_ref"] },
      { title: "Good Phase", skillRefs: ["cnode_abc001"] },
    ],
    edges: [],
  };

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.equal(result.diagnostics.emptyPhaseCount, 1);
  assert.equal(result.diagnostics.totalAssignedSkillRefs, 1);
});

test("resolveProgressionAgainstExistingNodes: position is zero-indexed and sequential", () => {
  const nodes = makeDbSkillNodes();
  const progression = makeProgressionWithRealIds();

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.equal(result.resolvedPhases[0].position, 0);
  assert.equal(result.resolvedPhases[1].position, 1);
  assert.equal(result.resolvedPhases[2].position, 2);
});

test("resolveProgressionAgainstExistingNodes: resolves canonical skill refs derived from titles", () => {
  const nodes = makeDbSkillNodes();

  const progression: CurriculumAiProgression = {
    phases: [
      {
        title: "Phase 1",
        skillRefs: [
          "skill:practical-life-cooking-and-kitchen-independence/montessori-foundations/introduction-and-readiness/board-setup",
          "skill:practical-life-cooking-and-kitchen-independence/montessori-foundations/introduction-and-readiness/piece-movement",
        ],
      },
    ],
    edges: [
      {
        fromSkillRef:
          "skill:practical-life-cooking-and-kitchen-independence/montessori-foundations/introduction-and-readiness/board-setup",
        toSkillRef:
          "skill:practical-life-cooking-and-kitchen-independence/montessori-foundations/introduction-and-readiness/piece-movement",
        kind: "hardPrerequisite",
      },
    ],
  };

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.deepEqual(result.resolvedPhases[0].nodeIds, ["cnode_abc001", "cnode_abc002"]);
  assert.equal(result.resolvedPrerequisites.length, 1);
  assert.equal(result.diagnostics.droppedEdgeCount, 0);
});

test("resolveProgressionAgainstExistingNodes: resolves legacy label-path skill refs", () => {
  const nodes = makeDbSkillNodes();

  const progression: CurriculumAiProgression = {
    phases: [
      {
        title: "Phase 1",
        skillRefs: [
          "Practical Life Cooking and Kitchen Independence / Montessori Foundations / Introduction and Readiness / Board Setup",
          "Practical Life Cooking and Kitchen Independence / Montessori Foundations / Introduction and Readiness / Piece Movement",
        ],
      },
    ],
    edges: [
      {
        fromSkillRef:
          "Practical Life Cooking and Kitchen Independence / Montessori Foundations / Introduction and Readiness / Board Setup",
        toSkillRef:
          "Practical Life Cooking and Kitchen Independence / Montessori Foundations / Introduction and Readiness / Piece Movement",
        kind: "hardPrerequisite",
      },
    ],
  };

  const result = resolveProgressionAgainstExistingNodes("src-1", nodes, progression);

  assert.deepEqual(result.resolvedPhases[0].nodeIds, ["cnode_abc001", "cnode_abc002"]);
  assert.equal(result.resolvedPrerequisites.length, 1);
  assert.equal(result.diagnostics.droppedEdgeCount, 0);
});
