import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProgressionGenerationInput,
  createProgressionGenerationBasis,
} from "../lib/curriculum/progression-basis.ts";

function makeBasis() {
  const source = {
    id: "source_1",
    householdId: "org_1",
    title: "Project Science",
    description: "Project science curriculum",
    kind: "ai_draft",
    status: "active",
    subjects: ["Science"],
    gradeLevels: ["elementary"],
    indexingStatus: "not_applicable",
    importVersion: 1,
    pacing: {
      totalWeeks: 6,
      sessionsPerWeek: 3,
      sessionMinutes: 45,
    },
    sourceModel: {
      routedRoute: "outline",
      confidence: "high",
      sourceKind: "structured_sequence",
      entryStrategy: "section_start",
      continuationMode: "sequential",
      deliveryPattern: "task_first",
      recommendedHorizon: "starter_module",
      assumptions: [],
      detectedChunks: ["launch"],
      needsConfirmation: false,
      sourcePackageIds: [],
      sourcePackages: [],
      sourceModalities: [],
    },
    curriculumLineage: { requestMode: "source_entry" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as const;

  const tree = {
    source,
    rootNodes: [
      {
        id: "domain_1",
        sourceId: "source_1",
        parentNodeId: null,
        normalizedType: "domain",
        title: "Science",
        sequenceIndex: 0,
        depth: 0,
        normalizedPath: "domain:science",
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
            title: "Projects",
            sequenceIndex: 0,
            depth: 1,
            normalizedPath: "domain:science/strand:projects",
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
                title: "Launch",
                sequenceIndex: 0,
                depth: 2,
                normalizedPath: "domain:science/strand:projects/goal_group:launch",
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
                    title: "Project setup",
                    sequenceIndex: 0,
                    depth: 3,
                    normalizedPath: "domain:science/strand:projects/goal_group:launch/skill:project-setup",
                    isActive: true,
                    sourcePayload: {},
                    metadata: {
                      rawPath: ["Science", "Projects", "Launch", "Project setup"],
                      canonicalSequenceIndex: 0,
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
    nodeCount: 4,
    skillCount: 1,
    canonicalSkillNodeIds: ["skill_1"],
  } as const;

  const units = [
    {
      id: "unit_1",
      sourceId: "source_1",
      unitRef: "unit:1:launch",
      title: "Launch",
      description: "Project launch block",
      sequence: 0,
      estimatedWeeks: 2,
      estimatedSessions: 6,
      skillRefs: ["skill:science/projects/launch/project-setup"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ] as const;

  return createProgressionGenerationBasis({
    source,
    tree,
    units: [...units],
  });
}

test("preview and live progression payloads share the exact same basis shape", () => {
  const basis = makeBasis();
  const livePayload = buildProgressionGenerationInput({
    learnerName: "Ed",
    basis,
  });
  const previewPayload = buildProgressionGenerationInput({
    learnerName: "Ed",
    basis,
  });

  assert.deepEqual(previewPayload, livePayload);
  assert.deepEqual(Object.keys(previewPayload).sort(), [
    "continuationMode",
    "deliveryPattern",
    "entryStrategy",
    "gradeLevels",
    "learnerName",
    "learnerPriorKnowledge",
    "requestMode",
    "sessionMinutes",
    "sessionsPerWeek",
    "skillCatalog",
    "sourceKind",
    "sourceSummary",
    "sourceTitle",
    "suggestedPhaseCountMax",
    "suggestedPhaseCountMin",
    "totalSessions",
    "totalWeeks",
    "unitAnchors",
  ]);
});
