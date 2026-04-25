import assert from "node:assert/strict";
import test from "node:test";

import { resolveProgressionAgainstBasis } from "../lib/curriculum/progression-regeneration.ts";
import type { ProgressionGenerationBasis } from "../lib/curriculum/progression-basis.ts";

function makeBasis(): ProgressionGenerationBasis {
  const source = {
    id: "source_1",
    householdId: "org_1",
    title: "Demo",
    kind: "ai_draft",
    status: "active",
    subjects: [],
    gradeLevels: [],
    indexingStatus: "not_applicable",
    importVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    source,
    tree: {
      source,
      rootNodes: [],
      nodeCount: 0,
      skillCount: 2,
      canonicalSkillNodeIds: ["node_a", "node_b"],
    },
    units: [],
    skillCatalog: [
      { skillRef: "skill:a", title: "Skill A", ordinal: 1 },
      { skillRef: "skill:b", title: "Skill B", ordinal: 2 },
    ],
    unitAnchors: [{ unitRef: "unit:1", title: "Unit 1", description: "Start", orderIndex: 1, skillRefs: ["skill:a", "skill:b"] }],
    skillNodeIdByRef: new Map([
      ["skill:a", "node_a"],
      ["skill:b", "node_b"],
    ]),
    gradeLevels: [],
    learnerPriorKnowledge: "unknown",
  };
}

test("resolveProgressionAgainstBasis resolves canonical skillRefs to persisted node ids", () => {
  const result = resolveProgressionAgainstBasis({
    sourceId: "source_1",
    basis: makeBasis(),
    progression: {
      phases: [
        { title: "Phase 1", description: "Start", skillRefs: ["skill:a"] },
        { title: "Phase 2", description: "Continue", skillRefs: ["skill:b"] },
      ],
      edges: [{ fromSkillRef: "skill:a", toSkillRef: "skill:b", kind: "hardPrerequisite" }],
    },
  });

  assert.deepEqual(result.resolvedPhases[0].nodeIds, ["node_a"]);
  assert.deepEqual(result.resolvedPhases[1].nodeIds, ["node_b"]);
  assert.deepEqual(result.resolvedPrerequisites[0], {
    sourceId: "source_1",
    skillNodeId: "node_b",
    prerequisiteSkillNodeId: "node_a",
    kind: "hardPrerequisite",
  });
});

test("resolveProgressionAgainstBasis dedupes prerequisite rows by persisted node pair", () => {
  const result = resolveProgressionAgainstBasis({
    sourceId: "source_1",
    basis: makeBasis(),
    progression: {
      phases: [
        { title: "Phase 1", description: "Start", skillRefs: ["skill:a"] },
        { title: "Phase 2", description: "Continue", skillRefs: ["skill:b"] },
      ],
      edges: [
        { fromSkillRef: "skill:a", toSkillRef: "skill:b", kind: "hardPrerequisite" },
        { fromSkillRef: "skill:a", toSkillRef: "skill:b", kind: "recommendedBefore" },
      ],
    },
  });

  assert.equal(result.resolvedPrerequisites.length, 1);
  assert.deepEqual(result.resolvedPrerequisites[0], {
    sourceId: "source_1",
    skillNodeId: "node_b",
    prerequisiteSkillNodeId: "node_a",
    kind: "hardPrerequisite",
  });
});

test("resolveProgressionAgainstBasis throws when a canonical skillRef is unresolved", () => {
  assert.throws(
    () =>
      resolveProgressionAgainstBasis({
        sourceId: "source_1",
        basis: makeBasis(),
        progression: {
          phases: [{ title: "Phase 1", description: "Start", skillRefs: ["skill:missing"] }],
          edges: [],
        },
      }),
    /Unresolved canonical skillRef/,
  );
});
