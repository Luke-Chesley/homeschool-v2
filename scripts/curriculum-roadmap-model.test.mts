import assert from "node:assert/strict";
import test from "node:test";

import { createProgressionGenerationBasis } from "../lib/curriculum/progression-basis.ts";
import { buildCurriculumRoadmapModel } from "../lib/curriculum/roadmap-model.ts";
import type { CurriculumProgressionData } from "../lib/curriculum/service.ts";
import type {
  CurriculumSource,
  CurriculumTree,
  CurriculumTreeNode,
  CurriculumUnitOutline,
} from "../lib/curriculum/types.ts";

function makeSource(overrides: Partial<CurriculumSource> = {}): CurriculumSource {
  return {
    id: "source_1",
    householdId: "org_1",
    title: "Roadmap test source",
    description: "A curriculum source for roadmap tests.",
    kind: "ai_draft",
    status: "active",
    academicYear: "2026",
    subjects: ["Integrated"],
    gradeLevels: ["elementary"],
    indexingStatus: "not_applicable",
    importVersion: 3,
    pacing: {
      totalWeeks: 8,
      sessionsPerWeek: 4,
      sessionMinutes: 35,
      totalSessions: 24,
    },
    sourceModel: {
      routedRoute: "outline",
      confidence: "high",
      sourceKind: "structured_sequence",
      entryStrategy: "sequential_start",
      continuationMode: "sequential",
      deliveryPattern: "skill_first",
      recommendedHorizon: "one_week",
      assumptions: [],
      detectedChunks: ["unit-1"],
      needsConfirmation: false,
      sourcePackageIds: [],
      sourcePackages: [],
      sourceModalities: [],
    },
    launchPlan: {
      chosenHorizon: "one_week",
      scopeSummary: "Start with the opening skills and first unit.",
      initialSliceUsed: true,
      initialSliceLabel: "Start here",
      openingUnitRefs: ["unit:1"],
      openingSkillNodeIds: ["skill_1"],
    },
    curriculumLineage: { requestMode: "source_entry" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSkillNode(
  id: string,
  title: string,
  canonicalSequenceIndex: number,
  rawPath: string[],
): CurriculumTreeNode {
  return {
    id,
    sourceId: "source_1",
    parentNodeId: null,
    normalizedType: "skill",
    title,
    sequenceIndex: canonicalSequenceIndex,
    depth: 3,
    normalizedPath: `skill:${title.toLowerCase().replace(/\s+/g, "-")}`,
    isActive: true,
    sourcePayload: {},
    metadata: {
      rawPath,
      canonicalSequenceIndex,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [],
  };
}

function makeGoalGroupNode(id: string, title: string, children: CurriculumTreeNode[]): CurriculumTreeNode {
  return {
    id,
    sourceId: "source_1",
    parentNodeId: null,
    normalizedType: "goal_group",
    title,
    sequenceIndex: 0,
    depth: 2,
    normalizedPath: `goal_group:${title.toLowerCase().replace(/\s+/g, "-")}`,
    isActive: true,
    sourcePayload: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children,
  };
}

function makeStrandNode(id: string, title: string, children: CurriculumTreeNode[]): CurriculumTreeNode {
  return {
    id,
    sourceId: "source_1",
    parentNodeId: null,
    normalizedType: "strand",
    title,
    sequenceIndex: 0,
    depth: 1,
    normalizedPath: `strand:${title.toLowerCase().replace(/\s+/g, "-")}`,
    isActive: true,
    sourcePayload: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children,
  };
}

function makeDomainNode(id: string, title: string, sequenceIndex: number, children: CurriculumTreeNode[]): CurriculumTreeNode {
  return {
    id,
    sourceId: "source_1",
    parentNodeId: null,
    normalizedType: "domain",
    title,
    sequenceIndex,
    depth: 0,
    normalizedPath: `domain:${title.toLowerCase().replace(/\s+/g, "-")}`,
    isActive: true,
    sourcePayload: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children,
  };
}

function makeTree(params: {
  source?: CurriculumSource;
  domains: Array<{
    id: string;
    title: string;
    sequenceIndex: number;
    strands: Array<{
      id: string;
      title: string;
      goalGroups: Array<{
        id: string;
        title: string;
        skills: Array<{ id: string; title: string; canonicalSequenceIndex: number }>;
      }>;
    }>;
  }>;
}): CurriculumTree {
  const rootNodes = params.domains.map((domain) =>
    makeDomainNode(
      domain.id,
      domain.title,
      domain.sequenceIndex,
      domain.strands.map((strand) =>
        makeStrandNode(
          strand.id,
          strand.title,
          strand.goalGroups.map((goalGroup) =>
            makeGoalGroupNode(
              goalGroup.id,
              goalGroup.title,
              goalGroup.skills.map((skill) =>
                makeSkillNode(
                  skill.id,
                  skill.title,
                  skill.canonicalSequenceIndex,
                  [domain.title, strand.title, goalGroup.title, skill.title],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  const canonicalSkillNodeIds = params.domains
    .flatMap((domain) => domain.strands)
    .flatMap((strand) => strand.goalGroups)
    .flatMap((goalGroup) => goalGroup.skills)
    .sort((left, right) => left.canonicalSequenceIndex - right.canonicalSequenceIndex)
    .map((skill) => skill.id);

  return {
    source: params.source ?? makeSource(),
    rootNodes,
    nodeCount: canonicalSkillNodeIds.length + params.domains.length * 3,
    skillCount: canonicalSkillNodeIds.length,
    canonicalSkillNodeIds,
  };
}

function makeOutline(units: Array<{
  id: string;
  unitRef: string;
  title: string;
  description?: string;
  sequence: number;
  estimatedWeeks?: number;
  estimatedSessions?: number;
  skillRefs: string[];
  lessons?: Array<{ id: string; title: string; lessonRef: string; linkedSkillRefs: string[] }>;
}>): CurriculumUnitOutline[] {
  return units.map((unit) => ({
    id: unit.id,
    sourceId: "source_1",
    unitRef: unit.unitRef,
    title: unit.title,
    description: unit.description,
    sequence: unit.sequence,
    estimatedWeeks: unit.estimatedWeeks,
    estimatedSessions: unit.estimatedSessions,
    skillRefs: unit.skillRefs,
    lessons: (unit.lessons ?? []).map((lesson, index) => ({
      id: lesson.id,
      unitId: unit.id,
      unitRef: unit.unitRef,
      lessonRef: lesson.lessonRef,
      title: lesson.title,
      sequence: index,
      lessonType: "task",
      linkedSkillRefs: lesson.linkedSkillRefs,
      materials: [],
      objectives: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function makeProgression(params: {
  phases?: Array<{
    id: string;
    title: string;
    description?: string;
    position: number;
    skillNodeIds: string[];
  }>;
  prerequisites?: Array<{
    id: string;
    skillNodeId: string;
    prerequisiteSkillNodeId: string;
    kind: string;
  }>;
  diagnostics?: Partial<CurriculumProgressionData["diagnostics"]>;
}): CurriculumProgressionData {
  const phases = params.phases ?? [];
  const prerequisites = params.prerequisites ?? [];
  const explicitEdgeCount = prerequisites.filter((edge) => edge.kind !== "inferred").length;
  const hasExplicit = phases.some((phase) => phase.skillNodeIds.length > 0) || explicitEdgeCount > 0;

  return {
    phases: phases.map((phase) => ({
      ...phase,
      description: phase.description,
    })),
    prerequisites,
    diagnostics: {
      hasExplicitProgression: hasExplicit,
      usingInferredFallback: !hasExplicit,
      phaseCount: phases.length,
      phaseMembershipCount: phases.reduce((total, phase) => total + phase.skillNodeIds.length, 0),
      emptyPhaseCount: phases.filter((phase) => phase.skillNodeIds.length === 0).length,
      explicitPrereqCount: explicitEdgeCount,
      acceptedEdgeCount: explicitEdgeCount,
      droppedEdgeCount: 0,
      progressionStatus: hasExplicit ? "explicit_ready" : "fallback_only",
      lastAttemptAt: null,
      lastFailureCategory: null,
      lastFailureReason: null,
      attemptCount: 0,
      provenance: hasExplicit ? "initial_generation" : "fallback_inference",
      rawAttemptSummaries: [],
      ...params.diagnostics,
    },
  };
}

function makeKitchenBasisFixture() {
  const source = makeSource({
    title: "Kitchen work",
    subjects: ["Practical Life"],
    gradeLevels: ["preschool"],
    launchPlan: {
      chosenHorizon: "one_week",
      scopeSummary: "Begin with safe kitchen readiness.",
      initialSliceUsed: true,
      initialSliceLabel: "Kitchen launch",
      openingUnitRefs: ["unit:1:readiness"],
      openingSkillNodeIds: ["skill_1"],
    },
  });

  const tree = makeTree({
    source,
    domains: [
      {
        id: "domain_1",
        title: "Kitchen work",
        sequenceIndex: 0,
        strands: [
          {
            id: "strand_1",
            title: "Readiness",
            goalGroups: [
              {
                id: "goal_1",
                title: "Foundations",
                skills: [
                  { id: "skill_1", title: "Knife safety", canonicalSequenceIndex: 0 },
                  { id: "skill_2", title: "Make snack", canonicalSequenceIndex: 1 },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  const outline = makeOutline([
    {
      id: "unit_db_1",
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
      lessons: [
        {
          id: "lesson_1",
          title: "Knife safety check-in",
          lessonRef: "lesson:knife-safety-check-in",
          linkedSkillRefs: ["skill:kitchen-work/readiness/foundations/knife-safety"],
        },
      ],
    },
  ]);

  const basis = createProgressionGenerationBasis(
    {
      source,
      tree,
      units: outline,
    },
  );

  return { source, tree, outline, basis };
}

test("buildCurriculumRoadmapModel groups a phased curriculum by unit when unit anchors are strong", () => {
  const { source, tree, outline, basis } = makeKitchenBasisFixture();

  const roadmap = buildCurriculumRoadmapModel({
    tree,
    outline,
    basis,
    progression: makeProgression({
      phases: [
        {
          id: "phase_1",
          title: "Launch safely",
          description: "Start with access and safety.",
          position: 0,
          skillNodeIds: ["skill_1", "skill_2"],
        },
      ],
    }),
  });

  assert.equal(roadmap.summary.totalSkills, 2);
  assert.equal(roadmap.summary.totalUnits, 1);
  assert.equal(roadmap.summary.totalLessons, 1);
  assert.equal(roadmap.summary.pacing.label, "8 weeks · 24 sessions · 4/week · 35 min");
  assert.equal(roadmap.summary.launchSlice?.label, "Kitchen launch");
  assert.equal(roadmap.phases[0]?.groupingStrategy, "unit");
  assert.equal(roadmap.phases[0]?.groups[0]?.title, "Readiness");
  assert.equal(roadmap.skillById.skill_1?.instructionalRole, "safety");
  assert.equal(roadmap.skillById.skill_1?.requiresAdultSupport, true);
  assert.equal(roadmap.skillById.skill_1?.safetyCritical, true);
  assert.equal(roadmap.skillById.skill_1?.unitRef, "unit:1:readiness");
  assert.equal(roadmap.skillById.skill_1?.launchSlice.viaSkill, true);
  assert.equal(roadmap.skillById.skill_1?.lessonCount, 1);
  assert.equal(roadmap.filters.roles.some((role) => role.id === "safety"), true);
  assert.equal(roadmap.structureIndex.phaseIdBySkillId.skill_1, "phase_1");
});

test("buildCurriculumRoadmapModel builds semantic dependency summaries and launch-slice membership", () => {
  const { tree, outline, basis } = makeKitchenBasisFixture();

  const roadmap = buildCurriculumRoadmapModel({
    tree,
    outline,
    basis,
    progression: makeProgression({
      phases: [
        {
          id: "phase_1",
          title: "Foundations",
          description: "Start here.",
          position: 0,
          skillNodeIds: ["skill_1"],
        },
        {
          id: "phase_2",
          title: "Application",
          description: "Use the work.",
          position: 1,
          skillNodeIds: ["skill_2"],
        },
      ],
      prerequisites: [
        { id: "edge_1", skillNodeId: "skill_2", prerequisiteSkillNodeId: "skill_1", kind: "hardPrerequisite" },
        { id: "edge_2", skillNodeId: "skill_2", prerequisiteSkillNodeId: "skill_1", kind: "recommendedBefore" },
        { id: "edge_3", skillNodeId: "skill_2", prerequisiteSkillNodeId: "skill_1", kind: "revisitAfter" },
        { id: "edge_4", skillNodeId: "skill_2", prerequisiteSkillNodeId: "skill_1", kind: "coPractice" },
      ],
    }),
  });

  assert.deepEqual(roadmap.skillById.skill_2?.dependencySummary.hardPrerequisite.titles, ["Knife safety"]);
  assert.deepEqual(roadmap.skillById.skill_2?.dependencySummary.recommendedBefore.titles, ["Knife safety"]);
  assert.deepEqual(roadmap.skillById.skill_2?.dependencySummary.revisitAfter.titles, ["Knife safety"]);
  assert.deepEqual(roadmap.skillById.skill_2?.dependencySummary.coPractice.titles, ["Knife safety"]);
  assert.deepEqual(roadmap.skillById.skill_1?.dependencySummary.unlocks.titles, ["Make snack"]);
  assert.equal(roadmap.skillById.skill_2?.launchSlice.viaUnit, true);
});

test("buildCurriculumRoadmapModel renders a no-phase fallback roadmap cleanly", () => {
  const source = makeSource({
    launchPlan: undefined,
  });
  const tree = makeTree({
    source,
    domains: [
      {
        id: "domain_math",
        title: "Math",
        sequenceIndex: 0,
        strands: [
          {
            id: "strand_math",
            title: "Fractions",
            goalGroups: [
              {
                id: "goal_math",
                title: "Core ideas",
                skills: [
                  { id: "skill_1", title: "Identify wholes and parts", canonicalSequenceIndex: 0 },
                  { id: "skill_2", title: "Compare fractions", canonicalSequenceIndex: 1 },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const outline = makeOutline([]);
  const basis = createProgressionGenerationBasis(
    {
      source,
      tree,
      units: outline,
    },
    { allowUnitless: true },
  );

  const roadmap = buildCurriculumRoadmapModel({
    tree,
    outline,
    basis,
    progression: makeProgression({
      diagnostics: {
        hasExplicitProgression: false,
        usingInferredFallback: true,
        progressionStatus: "fallback_only",
      },
    }),
  });

  assert.equal(roadmap.phases.length, 1);
  assert.equal(roadmap.phases[0]?.title, "Recommended sequence");
  assert.equal(roadmap.phases[0]?.isFallback, true);
  assert.equal(roadmap.phases[0]?.groupingStrategy, "domain");
  assert.equal(roadmap.summary.progression.label, "Fallback sequence");
  assert.equal(roadmap.summary.totalUnits, 0);
  assert.equal(roadmap.summary.launchSlice, null);
});

test("buildCurriculumRoadmapModel adds a final unplaced phase when some skills are not phased", () => {
  const source = makeSource();
  const tree = makeTree({
    source,
    domains: [
      {
        id: "domain_ela",
        title: "Language arts",
        sequenceIndex: 0,
        strands: [
          {
            id: "strand_ela",
            title: "Writing",
            goalGroups: [
              {
                id: "goal_ela",
                title: "Drafting",
                skills: [
                  { id: "skill_1", title: "Plan idea", canonicalSequenceIndex: 0 },
                  { id: "skill_2", title: "Draft paragraph", canonicalSequenceIndex: 1 },
                  { id: "skill_3", title: "Revise work", canonicalSequenceIndex: 2 },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const outline = makeOutline([
    {
      id: "unit_1",
      unitRef: "unit:writing",
      title: "Writing workshop",
      sequence: 0,
      skillRefs: [
        "skill:language-arts/writing/drafting/plan-idea",
        "skill:language-arts/writing/drafting/draft-paragraph",
      ],
    },
  ]);
  const basis = createProgressionGenerationBasis(
    {
      source,
      tree,
      units: outline,
    },
    { allowUnitless: true },
  );

  const roadmap = buildCurriculumRoadmapModel({
    tree,
    outline,
    basis,
    progression: makeProgression({
      phases: [
        {
          id: "phase_1",
          title: "Start writing",
          position: 0,
          skillNodeIds: ["skill_1", "skill_2"],
        },
      ],
    }),
  });

  assert.equal(roadmap.phases.length, 2);
  assert.equal(roadmap.phases[1]?.title, "Needs placement");
  assert.deepEqual(roadmap.phases[1]?.groups[0]?.skillIds, ["skill_3"]);
  assert.equal(roadmap.structureIndex.phaseIdBySkillId.skill_3, "phase:unplaced");
});

test("buildCurriculumRoadmapModel falls back to domain groups when unit anchors are fragmented", () => {
  const source = makeSource({
    launchPlan: undefined,
  });
  const tree = makeTree({
    source,
    domains: [
      {
        id: "domain_history",
        title: "History",
        sequenceIndex: 0,
        strands: [
          {
            id: "strand_history",
            title: "Research",
            goalGroups: [
              {
                id: "goal_history",
                title: "Interpretation",
                skills: [
                  { id: "skill_1", title: "Read source", canonicalSequenceIndex: 0 },
                  { id: "skill_2", title: "Compare evidence", canonicalSequenceIndex: 1 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "domain_project",
        title: "Project work",
        sequenceIndex: 1,
        strands: [
          {
            id: "strand_project",
            title: "Making",
            goalGroups: [
              {
                id: "goal_project",
                title: "Build",
                skills: [
                  { id: "skill_3", title: "Plan exhibit", canonicalSequenceIndex: 2 },
                  { id: "skill_4", title: "Present findings", canonicalSequenceIndex: 3 },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const outline = makeOutline([
    {
      id: "unit_1",
      unitRef: "unit:1",
      title: "Unit one",
      sequence: 0,
      skillRefs: ["skill:history/research/interpretation/read-source"],
    },
    {
      id: "unit_2",
      unitRef: "unit:2",
      title: "Unit two",
      sequence: 1,
      skillRefs: ["skill:history/research/interpretation/compare-evidence"],
    },
    {
      id: "unit_3",
      unitRef: "unit:3",
      title: "Unit three",
      sequence: 2,
      skillRefs: ["skill:project-work/making/build/plan-exhibit"],
    },
  ]);
  const basis = createProgressionGenerationBasis(
    {
      source,
      tree,
      units: outline,
    },
    { allowUnitless: true },
  );

  const roadmap = buildCurriculumRoadmapModel({
    tree,
    outline,
    basis,
    progression: makeProgression({
      phases: [
        {
          id: "phase_1",
          title: "Build understanding",
          position: 0,
          skillNodeIds: ["skill_1", "skill_2", "skill_3", "skill_4"],
        },
      ],
    }),
  });

  assert.equal(roadmap.phases[0]?.groupingStrategy, "domain");
  assert.deepEqual(
    roadmap.phases[0]?.groups.map((group) => group.title),
    ["History", "Project work"],
  );
});

test("buildCurriculumRoadmapModel stays robust with low-data unitless curricula", () => {
  const source = makeSource({
    title: "Low-data source",
    pacing: undefined,
    launchPlan: undefined,
  });
  const tree = makeTree({
    source,
    domains: [
      {
        id: "domain_1",
        title: "Projects",
        sequenceIndex: 0,
        strands: [
          {
            id: "strand_1",
            title: "Making",
            goalGroups: [
              {
                id: "goal_1",
                title: "Try it",
                skills: [{ id: "skill_1", title: "Build first draft", canonicalSequenceIndex: 0 }],
              },
            ],
          },
        ],
      },
    ],
  });
  const outline = makeOutline([]);
  const basis = createProgressionGenerationBasis(
    {
      source,
      tree,
      units: outline,
    },
    { allowUnitless: true },
  );

  const roadmap = buildCurriculumRoadmapModel({
    tree,
    outline,
    basis,
    progression: makeProgression({}),
  });

  assert.equal(roadmap.summary.pacing.label, null);
  assert.equal(roadmap.summary.totalLessons, 0);
  assert.equal(roadmap.phases[0]?.groups[0]?.title, "Projects");
  assert.equal(roadmap.skillById.skill_1?.unitRef, null);
});
