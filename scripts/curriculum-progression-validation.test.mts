import assert from "node:assert/strict";
import test from "node:test";

import { validateGeneratedProgression } from "../lib/curriculum/progression-validation.ts";
import type { ProgressionGenerationBasis } from "../lib/curriculum/progression-basis.ts";

function makeBasis(): ProgressionGenerationBasis {
  const source = {
    id: "source_1",
    householdId: "org_1",
    title: "Demo",
    description: "Demo",
    kind: "ai_draft",
    status: "active",
    subjects: [],
    gradeLevels: ["elementary"],
    indexingStatus: "not_applicable",
    importVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const skillNodeIdByRef = new Map<string, string>([
    ["skill:a", "node_a"],
    ["skill:b", "node_b"],
    ["skill:c", "node_c"],
  ]);

  return {
    source,
    tree: {
      source,
      rootNodes: [],
      nodeCount: 0,
      skillCount: 3,
      canonicalSkillNodeIds: ["node_a", "node_b", "node_c"],
    },
    units: [],
    skillCatalog: [
      { skillRef: "skill:a", title: "A", ordinal: 1, unitRef: "unit:1", unitTitle: "Unit 1", unitOrderIndex: 1 },
      { skillRef: "skill:b", title: "B", ordinal: 2, unitRef: "unit:1", unitTitle: "Unit 1", unitOrderIndex: 1 },
      { skillRef: "skill:c", title: "C", ordinal: 3, unitRef: "unit:2", unitTitle: "Unit 2", unitOrderIndex: 2 },
    ],
    unitAnchors: [
      { unitRef: "unit:1", title: "Unit 1", description: "Start here", orderIndex: 1, skillRefs: ["skill:a", "skill:b"] },
      { unitRef: "unit:2", title: "Unit 2", description: "Then continue", orderIndex: 2, skillRefs: ["skill:c"] },
    ],
    skillNodeIdByRef,
    gradeLevels: ["elementary"],
    learnerPriorKnowledge: "unknown",
    totalSessions: 12,
    suggestedPhaseCountMin: 3,
    suggestedPhaseCountMax: 5,
  };
}

test("validateGeneratedProgression fails when skill refs are missing from all phases", () => {
  const result = validateGeneratedProgression({
    basis: makeBasis(),
    progression: {
      phases: [{ title: "Phase 1", description: "Start", skillRefs: ["skill:a", "skill:b"] }],
      edges: [],
    },
  });

  assert.equal(result.fatalIssues.some((issue) => issue.code === "missing_skill_ref"), true);
  assert.deepEqual(result.stats.missingSkillRefs, ["skill:c"]);
});

test("validateGeneratedProgression fails on duplicate skill refs across phases", () => {
  const result = validateGeneratedProgression({
    basis: makeBasis(),
    progression: {
      phases: [
        { title: "Phase 1", description: "Start", skillRefs: ["skill:a", "skill:b"] },
        { title: "Phase 2", description: "Continue", skillRefs: ["skill:b", "skill:c"] },
      ],
      edges: [],
    },
  });

  assert.equal(result.fatalIssues.some((issue) => issue.code === "duplicate_skill_ref"), true);
  assert.deepEqual(result.stats.duplicateSkillRefs, ["skill:b"]);
});

test("validateGeneratedProgression fails on invented skill refs", () => {
  const result = validateGeneratedProgression({
    basis: makeBasis(),
    progression: {
      phases: [
        { title: "Phase 1", description: "Start", skillRefs: ["skill:a", "skill:invented"] },
        { title: "Phase 2", description: "Continue", skillRefs: ["skill:b", "skill:c"] },
      ],
      edges: [],
    },
  });

  assert.equal(result.fatalIssues.some((issue) => issue.code === "invented_skill_ref"), true);
  assert.deepEqual(result.stats.inventedSkillRefs, ["skill:invented"]);
});

test("validateGeneratedProgression fails on backward hardPrerequisite edges", () => {
  const result = validateGeneratedProgression({
    basis: makeBasis(),
    progression: {
      phases: [
        { title: "Phase 1", description: "Start", skillRefs: ["skill:a"] },
        { title: "Phase 2", description: "Continue", skillRefs: ["skill:b"] },
        { title: "Phase 3", description: "Finish", skillRefs: ["skill:c"] },
      ],
      edges: [
        { fromSkillRef: "skill:c", toSkillRef: "skill:a", kind: "hardPrerequisite" },
      ],
    },
  });

  assert.equal(result.fatalIssues.some((issue) => issue.code === "backward_hard_prerequisite"), true);
});

test("validateGeneratedProgression passes a valid canonical progression", () => {
  const result = validateGeneratedProgression({
    basis: makeBasis(),
    progression: {
      phases: [
        { title: "Phase 1", description: "Start", skillRefs: ["skill:a"] },
        { title: "Phase 2", description: "Continue", skillRefs: ["skill:b"] },
        { title: "Phase 3", description: "Finish", skillRefs: ["skill:c"] },
      ],
      edges: [
        { fromSkillRef: "skill:a", toSkillRef: "skill:b", kind: "hardPrerequisite" },
        { fromSkillRef: "skill:b", toSkillRef: "skill:c", kind: "recommendedBefore" },
        { fromSkillRef: "skill:a", toSkillRef: "skill:c", kind: "revisitAfter" },
      ],
    },
  });

  assert.deepEqual(result.fatalIssues, []);
  assert.equal(result.stats.acceptedEdgeCount, 3);
  assert.equal(result.stats.exactCanonicalResolution, true);
});
