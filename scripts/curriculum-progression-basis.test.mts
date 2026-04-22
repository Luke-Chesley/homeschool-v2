import assert from "node:assert/strict";
import test from "node:test";

import {
  createProgressionGenerationBasis,
  deriveSuggestedPhaseCountRange,
  inferInstructionalRole,
} from "../lib/curriculum/progression-basis.ts";

function makeSource() {
  return {
    id: "source_1",
    householdId: "org_1",
    title: "Kitchen work",
    description: "A practical life curriculum.",
    kind: "ai_draft",
    status: "active",
    academicYear: "2026",
    subjects: ["Practical Life"],
    gradeLevels: ["preschool"],
    indexingStatus: "not_applicable",
    importVersion: 1,
    pacing: {
      totalWeeks: 12,
      sessionsPerWeek: 5,
      sessionMinutes: 30,
      totalSessions: 60,
    },
    sourceModel: {
      routedRoute: "outline",
      confidence: "high",
      sourceKind: "comprehensive_source",
      entryStrategy: "section_start",
      continuationMode: "sequential",
      deliveryPattern: "mixed",
      recommendedHorizon: "two_weeks",
      assumptions: [],
      detectedChunks: ["intro"],
      needsConfirmation: false,
      sourcePackageIds: [],
      sourcePackages: [],
      sourceModalities: [],
    },
    launchPlan: undefined,
    curriculumLineage: { requestMode: "source_entry" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as const;
}

function makeTree() {
  return {
    source: makeSource(),
    rootNodes: [
      {
        id: "domain_1",
        sourceId: "source_1",
        parentNodeId: null,
        normalizedType: "domain",
        title: "Kitchen work",
        sequenceIndex: 0,
        depth: 0,
        normalizedPath: "domain:kitchen-work",
        isActive: true,
        sourcePayload: {},
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        children: [
          {
            id: "strand_1",
            sourceId: "source_1",
            parentNodeId: "domain_1",
            normalizedType: "strand",
            title: "Readiness",
            sequenceIndex: 0,
            depth: 1,
            normalizedPath: "domain:kitchen-work/strand:readiness",
            isActive: true,
            sourcePayload: {},
            metadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            children: [
              {
                id: "goal_1",
                sourceId: "source_1",
                parentNodeId: "strand_1",
                normalizedType: "goal_group",
                title: "Foundations",
                sequenceIndex: 0,
                depth: 2,
                normalizedPath: "domain:kitchen-work/strand:readiness/goal_group:foundations",
                isActive: true,
                sourcePayload: {},
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                children: [
                  {
                    id: "skill_1",
                    sourceId: "source_1",
                    parentNodeId: "goal_1",
                    normalizedType: "skill",
                    title: "Knife safety",
                    sequenceIndex: 0,
                    depth: 3,
                    normalizedPath:
                      "domain:kitchen-work/strand:readiness/goal_group:foundations/skill:knife-safety",
                    isActive: true,
                    sourcePayload: {},
                    metadata: {
                      rawPath: ["Kitchen Work", "Readiness", "Foundations", "Knife safety"],
                      canonicalSequenceIndex: 0,
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    children: [],
                  },
                  {
                    id: "skill_2",
                    sourceId: "source_1",
                    parentNodeId: "goal_1",
                    normalizedType: "skill",
                    title: "Make snack",
                    sequenceIndex: 1,
                    depth: 3,
                    normalizedPath:
                      "domain:kitchen-work/strand:readiness/goal_group:foundations/skill:make-snack",
                    isActive: true,
                    sourcePayload: {},
                    metadata: {
                      rawPath: ["Kitchen Work", "Readiness", "Foundations", "Make snack"],
                      canonicalSequenceIndex: 1,
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    nodeCount: 5,
    skillCount: 2,
    canonicalSkillNodeIds: ["skill_1", "skill_2"],
  } as const;
}

function makeUnits() {
  return [
    {
      id: "unit_db_1",
      sourceId: "source_1",
      unitRef: "unit:1:readiness",
      title: "Readiness",
      description: "Start with setup and safety.",
      sequence: 0,
      estimatedWeeks: 2,
      estimatedSessions: 8,
      skillRefs: [
        "skill:kitchen-work/readiness/foundations/knife-safety",
        "skill:kitchen-work/readiness/foundations/make-snack",
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ] as const;
}

test("inferInstructionalRole classifies safety, orientation, and application cues", () => {
  assert.equal(inferInstructionalRole({ title: "Knife safety" }), "safety");
  assert.equal(inferInstructionalRole({ title: "Introduction and overview" }), "orientation");
  assert.equal(inferInstructionalRole({ title: "Recipe project" }), "application");
  assert.equal(inferInstructionalRole({ title: "Whisk ingredients" }), "procedure");
});

test("deriveSuggestedPhaseCountRange uses session budget heuristics", () => {
  assert.deepEqual(deriveSuggestedPhaseCountRange({ totalSessions: 6, skillCount: 20 }), { min: 2, max: 4 });
  assert.deepEqual(deriveSuggestedPhaseCountRange({ totalSessions: 24, skillCount: 20 }), { min: 4, max: 6 });
  assert.deepEqual(deriveSuggestedPhaseCountRange({ skillCount: 41 }), { min: 5, max: 9 });
});

test("createProgressionGenerationBasis builds exact canonical skillRef to nodeId mapping", () => {
  const basis = createProgressionGenerationBasis({
    source: makeSource(),
    tree: makeTree(),
    units: [...makeUnits()],
  });

  assert.equal(
    basis.skillNodeIdByRef.get("skill:kitchen-work/readiness/foundations/knife-safety"),
    "skill_1",
  );
  assert.equal(
    basis.skillNodeIdByRef.get("skill:kitchen-work/readiness/foundations/make-snack"),
    "skill_2",
  );
  assert.equal(basis.skillCatalog[0].unitRef, "unit:1:readiness");
  assert.equal(basis.skillCatalog[0].instructionalRole, "safety");
  assert.equal(basis.totalSessions, 60);
  assert.equal(basis.suggestedPhaseCountMin, 5);
  assert.equal(basis.suggestedPhaseCountMax, 8);
});

test("createProgressionGenerationBasis assigns all skills to a lone legacy unit when skillRefs are missing", () => {
  const [legacyUnit] = makeUnits();
  const basis = createProgressionGenerationBasis({
    source: makeSource(),
    tree: makeTree(),
    units: [
      {
        ...legacyUnit,
        skillRefs: [],
      },
    ],
  });

  assert.deepEqual(basis.unitAnchors[0].skillRefs, [
    "skill:kitchen-work/readiness/foundations/knife-safety",
    "skill:kitchen-work/readiness/foundations/make-snack",
  ]);
  assert.equal(basis.skillCatalog[0].unitRef, "unit:1:readiness");
  assert.equal(basis.skillCatalog[1].unitRef, "unit:1:readiness");
});
