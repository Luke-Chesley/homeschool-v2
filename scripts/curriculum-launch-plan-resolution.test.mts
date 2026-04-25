import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLaunchPlanOpeningSkillNodeIds,
  resolveLaunchPlanOpeningUnitRefs,
} from "../lib/curriculum/ai-draft-service.ts";
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
      skillCount: 1,
      canonicalSkillNodeIds: ["node_a"],
    },
    units: [],
    skillCatalog: [{ skillRef: "skill:a", title: "Skill A", ordinal: 1 }],
    unitAnchors: [{ unitRef: "unit:1", title: "Unit 1", description: "Start", orderIndex: 1, skillRefs: ["skill:a"] }],
    skillNodeIdByRef: new Map([["skill:a", "node_a"]]),
    gradeLevels: [],
    learnerPriorKnowledge: "unknown",
  };
}

test("resolveLaunchPlanOpeningSkillNodeIds throws on unresolved openingSkillRef", () => {
  assert.throws(
    () =>
      resolveLaunchPlanOpeningSkillNodeIds({
        basis: makeBasis(),
        openingSkillRefs: ["skill:missing"],
      }),
    /unresolved openingSkillRefs/,
  );
});

test("resolveLaunchPlanOpeningUnitRefs derives owning units from opening skills", () => {
  const basis = makeBasis();
  basis.unitAnchors = [
    { unitRef: "unit:1", title: "Unit 1", description: "Start", orderIndex: 1, skillRefs: ["skill:a"] },
    { unitRef: "unit:2", title: "Unit 2", description: "Continue", orderIndex: 2, skillRefs: ["skill:b"] },
  ];

  const openingUnitRefs = resolveLaunchPlanOpeningUnitRefs({
    basis,
    openingSkillRefs: ["skill:a"],
  });

  assert.deepEqual(openingUnitRefs, ["unit:1"]);
});
