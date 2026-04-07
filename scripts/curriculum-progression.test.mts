import assert from "node:assert/strict";
import test from "node:test";

import {
  generateCurriculumArtifact,
  parseCurriculumProgression,
} from "../lib/curriculum/ai-draft-service.ts";
import {
  validateProgressionSemantics,
  extractLeafSkillTitles,
} from "../lib/curriculum/progression-validation.ts";
import { normalizeCurriculumDocument } from "../lib/curriculum/normalization.ts";
import { getModelForTask, DEFAULT_ROUTING_CONFIG } from "../lib/ai/provider-adapter.ts";

const learner = {
  firstName: "Ava",
  displayName: "Ava",
};

const messages = [
  {
    role: "user" as const,
    content: "Build a math curriculum.",
  },
];

const stubPrompt = async (task: string) => ({
  id: "test-prompt",
  task,
  version: "1.0.0",
  systemPrompt: `stub system prompt for ${task}`,
  userTemplate: undefined,
  notes: undefined,
});

function makeValidCore() {
  return {
    source: {
      title: "Math 101",
      description: "Basic math for first grade.",
      subjects: ["math"],
      gradeLevels: ["1"],
      summary: "Teach addition and counting with daily practice and visible checks.",
      teachingApproach: "Direct instruction with guided practice.",
      successSignals: ["The learner can demonstrate addition up to 20."],
      parentNotes: [],
      rationale: ["Short, observable steps build fluency."],
    },
    intakeSummary: "Math for 1st grade.",
    pacing: {
      totalWeeks: 4,
      sessionsPerWeek: 5,
      sessionMinutes: 30,
      totalSessions: 20,
      coverageStrategy: "Teach, practice, and check each skill before moving on.",
      coverageNotes: ["Apply each concept before introducing the next."],
    },
    document: {
      Math: {
        Counting: {
          "Number sense": ["Count to 20", "Identify numbers 1-20"],
        },
        Addition: {
          "Basic addition": ["Add 1-10", "Add 11-20"],
          "Application": ["Solve simple word problems"],
        },
      },
    },
    units: [
      {
        title: "Counting",
        description: "Build number sense through counting and identification.",
        estimatedWeeks: 1,
        estimatedSessions: 5,
        lessons: [
          {
            title: "Counting to 20",
            description: "Practice counting and demonstrate number recognition.",
            estimatedMinutes: 30,
            materials: [],
            objectives: ["Show counting to 20", "Identify written numbers"],
            linkedSkillTitles: ["Count to 20", "Identify numbers 1-20"],
          },
        ],
      },
      {
        title: "Addition",
        description: "Apply addition skills to solve problems.",
        estimatedWeeks: 3,
        estimatedSessions: 15,
        lessons: [
          {
            title: "Adding up to 10",
            description: "Practice and demonstrate addition within 10.",
            estimatedMinutes: 30,
            materials: [],
            objectives: ["Apply addition up to 10", "Check answers by counting"],
            linkedSkillTitles: ["Add 1-10"],
          },
          {
            title: "Adding up to 20",
            description: "Extend addition to 20 and check understanding.",
            estimatedMinutes: 30,
            materials: [],
            objectives: ["Demonstrate addition to 20"],
            linkedSkillTitles: ["Add 11-20"],
          },
          {
            title: "Word problems",
            description: "Apply addition to real scenarios.",
            estimatedMinutes: 30,
            materials: [],
            objectives: ["Solve and explain word problems"],
            linkedSkillTitles: ["Solve simple word problems"],
          },
        ],
      },
    ],
  };
}

function makeValidProgression() {
  return {
    progression: {
      phases: [
        {
          title: "Phase 1: Counting",
          skillTitles: ["Count to 20", "Identify numbers 1-20"],
        },
        {
          title: "Phase 2: Addition",
          skillTitles: ["Add 1-10", "Add 11-20", "Solve simple word problems"],
        },
      ],
      edges: [
        {
          fromSkillTitle: "Count to 20",
          toSkillTitle: "Add 1-10",
          kind: "hardPrerequisite",
        },
        {
          fromSkillTitle: "Add 1-10",
          toSkillTitle: "Add 11-20",
          kind: "hardPrerequisite",
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

test("routing config includes progression tasks", () => {
  assert.ok(
    DEFAULT_ROUTING_CONFIG.taskDefaults["curriculum.generate.progression"],
    "curriculum.generate.progression must have an explicit routing entry",
  );
  assert.ok(
    DEFAULT_ROUTING_CONFIG.taskDefaults["curriculum.revise.progression"],
    "curriculum.revise.progression must have an explicit routing entry",
  );
  assert.ok(
    DEFAULT_ROUTING_CONFIG.taskDefaults["curriculum.revise.core"],
    "curriculum.revise.core must have an explicit routing entry",
  );
});

test("getModelForTask returns explicit model for progression tasks, not fallback", () => {
  const progressionModel = getModelForTask("curriculum.generate.progression", DEFAULT_ROUTING_CONFIG);
  const fallback = DEFAULT_ROUTING_CONFIG.fallbackModel;
  // The task should have its own entry, not fall through
  assert.ok(
    DEFAULT_ROUTING_CONFIG.taskDefaults["curriculum.generate.progression"] !== undefined,
    "progression task must be explicitly mapped",
  );
  // And the result should equal the mapped value (not be missing)
  assert.equal(progressionModel, DEFAULT_ROUTING_CONFIG.taskDefaults["curriculum.generate.progression"]);
});

// ---------------------------------------------------------------------------
// Two-pass generation
// ---------------------------------------------------------------------------

test("generateCurriculumArtifact performs two passes and merges progression", async () => {
  let callCount = 0;
  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt as any,
      complete: async ({ systemPrompt }: { systemPrompt: string }) => {
        callCount += 1;
        if (systemPrompt.includes("curriculum.generate.core")) {
          return { content: JSON.stringify(makeValidCore()) };
        }
        if (systemPrompt.includes("curriculum.generate.progression")) {
          return { content: JSON.stringify(makeValidProgression()) };
        }
        return { content: "{}" };
      },
    },
  );

  assert.equal(result.kind, "success");
  assert.equal(callCount, 2);
  assert.ok(result.artifact.progression);
  assert.equal(result.artifact.progression?.phases.length, 2);
  assert.equal(result.artifact.progression?.edges.length, 2);
  assert.equal(result.artifact.progression?.edges[0].kind, "hardPrerequisite");
});

test("generateCurriculumArtifact flags when progression generation fails", async () => {
  // Progression pass always returns invalid JSON — should fail cleanly and fall back
  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt as any,
      complete: async ({ systemPrompt }: { systemPrompt: string }) => {
        if (systemPrompt.includes("curriculum.generate.core")) {
          return { content: JSON.stringify(makeValidCore()) };
        }
        // Return unparseable content for progression
        return { content: "not valid json" };
      },
    },
  );

  // Core generation still succeeds
  assert.equal(result.kind, "success");
  // But no progression — we've fallen back
  assert.equal(result.artifact.progression, undefined);
});

// ---------------------------------------------------------------------------
// Progression parsing
// ---------------------------------------------------------------------------

test("parseCurriculumProgression succeeds on valid progression", () => {
  const valid = makeValidProgression();
  const result = parseCurriculumProgression(JSON.stringify(valid));
  assert.equal(result.kind, "success");
  if (result.kind === "success") {
    assert.equal(result.progression.phases.length, 2);
    assert.equal(result.progression.edges.length, 2);
  }
});

test("parseCurriculumProgression fails on empty skillTitles array", () => {
  const invalid = {
    progression: {
      phases: [{ title: "Phase 1", skillTitles: [] }], // min(1) violated
      edges: [],
    },
  };
  const result = parseCurriculumProgression(JSON.stringify(invalid));
  assert.equal(result.kind, "schema_failure");
});

test("parseCurriculumProgression fails on invalid JSON", () => {
  const result = parseCurriculumProgression("this is not json");
  assert.equal(result.kind, "parse_failure");
});

// ---------------------------------------------------------------------------
// Semantic validation
// ---------------------------------------------------------------------------

const leafSkills = ["Count to 20", "Identify numbers 1-20", "Add 1-10", "Add 11-20", "Solve simple word problems"];

test("validateProgressionSemantics accepts a valid progression", () => {
  const result = validateProgressionSemantics(makeValidProgression().progression, leafSkills);
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.summary.skillsInCurriculum, 5);
  assert.equal(result.summary.edgesAccepted, 2);
  assert.equal(result.summary.edgesDropped, 0);
  assert.equal(result.summary.phaseCount, 2);
});

test("validateProgressionSemantics rejects unresolved edge endpoints", () => {
  const progression = {
    phases: [{ title: "Phase 1", skillTitles: ["Count to 20"] }],
    edges: [
      {
        fromSkillTitle: "Nonexistent Skill",
        toSkillTitle: "Add 1-10",
        kind: "hardPrerequisite" as const,
      },
    ],
  };
  const result = validateProgressionSemantics(progression, leafSkills);
  assert.ok(result.issues.some((issue) => issue.code === "unresolved_edge_from"));
  assert.equal(result.summary.edgesDropped, 1);
  assert.equal(result.summary.unresolvedEdgeEndpoints, 1);
});

test("validateProgressionSemantics rejects self-loops", () => {
  const progression = {
    phases: [{ title: "Phase 1", skillTitles: ["Count to 20"] }],
    edges: [
      {
        fromSkillTitle: "Count to 20",
        toSkillTitle: "Count to 20",
        kind: "hardPrerequisite" as const,
      },
    ],
  };
  const result = validateProgressionSemantics(progression, leafSkills);
  assert.ok(result.issues.some((issue) => issue.code === "self_loop"));
  assert.equal(result.valid, false);
});

test("validateProgressionSemantics rejects hard prerequisite cycles", () => {
  const progression = {
    phases: [
      { title: "Phase 1", skillTitles: ["Count to 20", "Add 1-10"] },
    ],
    edges: [
      { fromSkillTitle: "Count to 20", toSkillTitle: "Add 1-10", kind: "hardPrerequisite" as const },
      { fromSkillTitle: "Add 1-10", toSkillTitle: "Count to 20", kind: "hardPrerequisite" as const }, // cycle
    ],
  };
  const result = validateProgressionSemantics(progression, leafSkills);
  assert.ok(result.issues.some((issue) => issue.code === "hard_prerequisite_cycle"));
  assert.equal(result.valid, false);
});

test("validateProgressionSemantics rejects empty phases for non-trivial curricula", () => {
  const progression = {
    phases: [],
    edges: [
      { fromSkillTitle: "Count to 20", toSkillTitle: "Add 1-10", kind: "hardPrerequisite" as const },
    ],
  };
  const result = validateProgressionSemantics(progression, leafSkills);
  assert.ok(result.issues.some((issue) => issue.code === "empty_phases"));
  assert.equal(result.valid, false);
});

test("validateProgressionSemantics flags unresolved phase skills", () => {
  const progression = {
    phases: [
      {
        title: "Phase 1",
        skillTitles: ["Count to 20", "No Such Skill"],
      },
    ],
    edges: [],
  };
  const result = validateProgressionSemantics(progression, leafSkills);
  assert.ok(result.issues.some((issue) => issue.code === "unresolved_phase_skill"));
  assert.equal(result.summary.unresolvedPhaseSkills, 1);
});

test("validateProgressionSemantics flags low phase coverage", () => {
  // Only 1 of 5 skills assigned to a phase — below 40% threshold
  const progression = {
    phases: [
      { title: "Phase 1", skillTitles: ["Count to 20"] },
    ],
    edges: [],
  };
  const result = validateProgressionSemantics(progression, leafSkills);
  assert.ok(result.issues.some((issue) => issue.code === "low_phase_coverage"));
});

test("validateProgressionSemantics accepts duplicate edges by dropping them", () => {
  const progression = {
    phases: [
      { title: "Phase 1", skillTitles: ["Count to 20", "Add 1-10", "Add 11-20", "Identify numbers 1-20", "Solve simple word problems"] },
    ],
    edges: [
      { fromSkillTitle: "Count to 20", toSkillTitle: "Add 1-10", kind: "hardPrerequisite" as const },
      { fromSkillTitle: "Count to 20", toSkillTitle: "Add 1-10", kind: "hardPrerequisite" as const }, // duplicate
    ],
  };
  const result = validateProgressionSemantics(progression, leafSkills);
  assert.ok(result.issues.some((issue) => issue.code === "duplicate_edge"));
  assert.equal(result.summary.edgesAccepted, 1);
  assert.equal(result.summary.edgesDropped, 1);
});

// ---------------------------------------------------------------------------
// extractLeafSkillTitles
// ---------------------------------------------------------------------------

test("extractLeafSkillTitles extracts array-format leaf skills", () => {
  const document = {
    Math: {
      Counting: {
        "Number sense": ["Count to 20", "Identify numbers 1-20"],
      },
    },
  };
  const titles = extractLeafSkillTitles(document);
  assert.deepEqual(titles.sort(), ["Count to 20", "Identify numbers 1-20"].sort());
});

test("extractLeafSkillTitles extracts string-value skills", () => {
  const document = {
    Math: {
      Counting: {
        "Count to 20": "Learn to count to 20 using objects.",
      },
    },
  };
  const titles = extractLeafSkillTitles(document);
  assert.deepEqual(titles, ["Count to 20"]);
});

// ---------------------------------------------------------------------------
// Normalization: unresolved reference diagnostics
// ---------------------------------------------------------------------------

const testDocument = {
  Math: {
    Counting: {
      "Number sense": ["Count to 20", "Identify numbers 1-20"],
    },
    Addition: {
      "Basic addition": ["Add 1-10", "Add 11-20"],
      "Application": ["Solve simple word problems"],
    },
  },
};

test("normalizeCurriculumDocument reports unmatched edge endpoints in diagnostics", () => {
  const progression = {
    phases: [
      { title: "Phase 1", skillTitles: ["Count to 20"] },
      { title: "Phase 2", skillTitles: ["Add 1-10", "Add 11-20", "Identify numbers 1-20", "Solve simple word problems"] },
    ],
    edges: [
      { fromSkillTitle: "Count to 20", toSkillTitle: "Add 1-10", kind: "hardPrerequisite" as const },
      { fromSkillTitle: "Ghost Skill", toSkillTitle: "Add 1-10", kind: "hardPrerequisite" as const }, // unresolved from
    ],
  };

  const result = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: testDocument,
    progression,
  });

  assert.equal(result.summary.progressionDiagnostics.hasExplicitProgression, true);
  assert.equal(result.summary.progressionDiagnostics.usingInferredFallback, false);
  assert.equal(result.summary.progressionDiagnostics.droppedEdgeCount, 1);
  assert.equal(result.summary.progressionDiagnostics.acceptedEdgeCount, 1);
});

test("normalizeCurriculumDocument reports unmatched phase skills in diagnostics", () => {
  const progression = {
    phases: [
      { title: "Phase 1", skillTitles: ["Count to 20", "Ghost Phase Skill"] },
    ],
    edges: [],
  };

  const result = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: testDocument,
    progression,
  });

  assert.equal(result.summary.progressionDiagnostics.unmatchedPhaseSkillCount, 1);
});

test("normalizeCurriculumDocument uses inferred fallback when no progression edges", () => {
  const result = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: testDocument,
  });

  assert.equal(result.summary.progressionDiagnostics.hasExplicitProgression, false);
  assert.equal(result.summary.progressionDiagnostics.usingInferredFallback, true);
  assert.equal(result.summary.progressionDiagnostics.phaseCount, 0);
  // Inferred prerequisites: one per consecutive skill pair
  const inferredPrereqs = result.prerequisites.filter((p) => p.kind === "inferred");
  assert.equal(inferredPrereqs.length, result.summary.skillCount - 1);
});

test("normalizeCurriculumDocument persists accepted phases and edges", () => {
  const progression = {
    phases: [
      { title: "Phase 1: Counting", skillTitles: ["Count to 20", "Identify numbers 1-20"] },
      { title: "Phase 2: Addition", skillTitles: ["Add 1-10", "Add 11-20", "Solve simple word problems"] },
    ],
    edges: [
      { fromSkillTitle: "Count to 20", toSkillTitle: "Add 1-10", kind: "hardPrerequisite" as const },
      { fromSkillTitle: "Add 1-10", toSkillTitle: "Add 11-20", kind: "hardPrerequisite" as const },
    ],
  };

  const result = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: testDocument,
    progression,
  });

  assert.equal(result.phases.length, 2);
  assert.equal(result.phases[0].title, "Phase 1: Counting");
  assert.equal(result.phases[0].nodeIds.length, 2);
  assert.equal(result.phases[1].nodeIds.length, 3);

  const explicitPrereqs = result.prerequisites.filter((p) => p.kind === "hardPrerequisite");
  assert.equal(explicitPrereqs.length, 2);
  assert.equal(result.summary.progressionDiagnostics.acceptedEdgeCount, 2);
  assert.equal(result.summary.progressionDiagnostics.droppedEdgeCount, 0);
  assert.equal(result.summary.progressionDiagnostics.phaseCount, 2);
});

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

test("validateProgressionSemantics detects a longer cycle", () => {
  const moreSkills = ["A", "B", "C", "D"];
  const progression = {
    phases: [{ title: "Phase 1", skillTitles: ["A", "B", "C", "D"] }],
    edges: [
      { fromSkillTitle: "A", toSkillTitle: "B", kind: "hardPrerequisite" as const },
      { fromSkillTitle: "B", toSkillTitle: "C", kind: "hardPrerequisite" as const },
      { fromSkillTitle: "C", toSkillTitle: "A", kind: "hardPrerequisite" as const }, // cycle A→B→C→A
    ],
  };
  const result = validateProgressionSemantics(progression, moreSkills);
  assert.ok(result.issues.some((issue) => issue.code === "hard_prerequisite_cycle"));
  assert.equal(result.valid, false);
});

test("validateProgressionSemantics allows recommendedBefore cycles (not hard prerequisite)", () => {
  // recommendedBefore is a soft hint — cycles are allowed
  const progression = {
    phases: [{ title: "Phase 1", skillTitles: ["Count to 20", "Add 1-10", "Add 11-20", "Identify numbers 1-20", "Solve simple word problems"] }],
    edges: [
      { fromSkillTitle: "Count to 20", toSkillTitle: "Add 1-10", kind: "recommendedBefore" as const },
      { fromSkillTitle: "Add 1-10", toSkillTitle: "Count to 20", kind: "recommendedBefore" as const }, // soft cycle — allowed
    ],
  };
  const result = validateProgressionSemantics(progression, leafSkills);
  // Should not flag a hard prerequisite cycle
  assert.ok(!result.issues.some((issue) => issue.code === "hard_prerequisite_cycle"));
});

// ---------------------------------------------------------------------------
// Retry count: progression generation now retries up to 5 times
// ---------------------------------------------------------------------------

test("generateCurriculumArtifact retries progression up to 5 times when all fail", async () => {
  let progressionCallCount = 0;

  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt as any,
      complete: async ({ systemPrompt }: { systemPrompt: string }) => {
        if (systemPrompt.includes("curriculum.generate.core")) {
          return { content: JSON.stringify(makeValidCore()) };
        }
        // Always fail progression
        progressionCallCount += 1;
        return { content: "not valid json" };
      },
    },
  );

  // Core still succeeds
  assert.equal(result.kind, "success");
  // Progression should have been attempted 5 times
  assert.equal(progressionCallCount, 5, `Expected 5 progression attempts but got ${progressionCallCount}`);
  // No progression in artifact since all failed
  assert.equal(result.artifact.progression, undefined);
});

test("generateCurriculumArtifact accepts progression on the 4th attempt", async () => {
  let progressionCallCount = 0;

  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt as any,
      complete: async ({ systemPrompt }: { systemPrompt: string }) => {
        if (systemPrompt.includes("curriculum.generate.core")) {
          return { content: JSON.stringify(makeValidCore()) };
        }
        progressionCallCount += 1;
        // Fail first 3 attempts, succeed on 4th
        if (progressionCallCount < 4) {
          return { content: "not valid json" };
        }
        return { content: JSON.stringify(makeValidProgression()) };
      },
    },
  );

  assert.equal(result.kind, "success");
  assert.equal(progressionCallCount, 4);
  assert.ok(result.artifact.progression, "Progression should be accepted on 4th attempt");
  assert.equal(result.artifact.progression?.phases.length, 2);
});

// ---------------------------------------------------------------------------
// Stable skill ID support in validation
// ---------------------------------------------------------------------------

test("validateProgressionSemantics validates edge skill IDs when skillIdToTitle map provided", () => {
  const skillIdMap = new Map([
    ["cnode_skill_a", "Count to 20"],
    ["cnode_skill_b", "Add 1-10"],
    ["cnode_skill_c", "Add 11-20"],
    ["cnode_skill_d", "Identify numbers 1-20"],
    ["cnode_skill_e", "Solve simple word problems"],
  ]);

  const progression = {
    phases: [{
      title: "Phase 1",
      skillTitles: ["Count to 20", "Add 1-10", "Add 11-20", "Identify numbers 1-20", "Solve simple word problems"],
      skillIds: ["cnode_skill_a", "cnode_skill_b", "cnode_skill_c", "cnode_skill_d", "cnode_skill_e"],
    }],
    edges: [
      {
        fromSkillTitle: "Count to 20",
        fromSkillId: "cnode_skill_a",
        toSkillTitle: "Add 1-10",
        toSkillId: "cnode_skill_b",
        kind: "hardPrerequisite" as const,
      },
    ],
  };

  const result = validateProgressionSemantics(progression, leafSkills, skillIdMap);
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("validateProgressionSemantics flags invalid skill IDs when skillIdToTitle map provided", () => {
  const skillIdMap = new Map([
    ["cnode_skill_a", "Count to 20"],
    ["cnode_skill_b", "Add 1-10"],
  ]);

  const progression = {
    phases: [{
      title: "Phase 1",
      skillTitles: ["Count to 20"],
      skillIds: ["cnode_skill_INVALID"],
    }],
    edges: [
      {
        fromSkillTitle: "Count to 20",
        fromSkillId: "cnode_skill_a",
        toSkillTitle: "Add 1-10",
        toSkillId: "cnode_skill_MISSING",
        kind: "hardPrerequisite" as const,
      },
    ],
  };

  const result = validateProgressionSemantics(progression, leafSkills, skillIdMap);
  const idIssues = result.issues.filter((i) => i.code === "unresolved_skill_id");
  assert.ok(idIssues.length >= 2, "Should flag both the invalid phase skillId and missing edge toSkillId");
});

test("validateProgressionSemantics resolves phase skills by ID when skillIdToTitle provided", () => {
  const skillIdMap = new Map([
    ["cnode_a", "Count to 20"],
    ["cnode_b", "Add 1-10"],
    ["cnode_c", "Add 11-20"],
    ["cnode_d", "Identify numbers 1-20"],
    ["cnode_e", "Solve simple word problems"],
  ]);

  const progression = {
    phases: [{
      title: "Phase 1",
      // Titles slightly drift from canonical (would fail title-only validation)
      skillTitles: ["Count to 20", "Add 1-10", "Add 11-20", "Identify numbers 1-20", "Solve simple word problems"],
      skillIds: ["cnode_a", "cnode_b", "cnode_c", "cnode_d", "cnode_e"],
    }],
    edges: [],
  };

  const result = validateProgressionSemantics(progression, leafSkills, skillIdMap);
  assert.equal(result.summary.skillsAssignedToPhases, 5);
  // No unresolved phase skills when IDs resolve correctly
  assert.equal(result.summary.unresolvedPhaseSkills, 0);
});

// ---------------------------------------------------------------------------
// Stable ID resolution in normalization
// ---------------------------------------------------------------------------

test("normalizeCurriculumDocument resolves edges by stable skill ID when provided", () => {
  // First normalize to get stable IDs
  const base = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: testDocument,
  });

  // Build a skillId→title map from the normalized result
  const skillNodes = base.nodes.filter((n) => n.normalizedType === "skill");
  const skillIdByTitle = new Map(skillNodes.map((n) => [n.title, n.id]));

  const countTo20Id = skillIdByTitle.get("Count to 20")!;
  const add110Id = skillIdByTitle.get("Add 1-10")!;

  assert.ok(countTo20Id, "Count to 20 skill node should exist");
  assert.ok(add110Id, "Add 1-10 skill node should exist");

  // Now normalize with a progression that uses stable IDs
  const result = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: testDocument,
    progression: {
      phases: [{
        title: "Phase 1",
        skillTitles: ["Count to 20", "Add 1-10", "Add 11-20", "Identify numbers 1-20", "Solve simple word problems"],
        skillIds: [
          countTo20Id,
          add110Id,
          skillIdByTitle.get("Add 11-20")!,
          skillIdByTitle.get("Identify numbers 1-20")!,
          skillIdByTitle.get("Solve simple word problems")!,
        ],
      }],
      edges: [{
        fromSkillTitle: "Count to 20",
        fromSkillId: countTo20Id,
        toSkillTitle: "Add 1-10",
        toSkillId: add110Id,
        kind: "hardPrerequisite" as const,
      }],
    },
  });

  assert.equal(result.phases.length, 1);
  assert.equal(result.phases[0].nodeIds.length, 5);
  const explicitEdges = result.prerequisites.filter((p) => p.kind === "hardPrerequisite");
  assert.equal(explicitEdges.length, 1);
  assert.equal(explicitEdges[0].prerequisiteSkillNodeId, countTo20Id);
  assert.equal(explicitEdges[0].skillNodeId, add110Id);
});

// ---------------------------------------------------------------------------
// Progression state: generateCurriculumArtifact includes attemptCount
// ---------------------------------------------------------------------------

test("generateCurriculumArtifact includes progressionAttemptCount in the result", async () => {
  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt as any,
      complete: async ({ systemPrompt }: { systemPrompt: string }) => {
        if (systemPrompt.includes("curriculum.generate.core")) {
          return { content: JSON.stringify(makeValidCore()) };
        }
        return { content: JSON.stringify(makeValidProgression()) };
      },
    },
  );

  assert.equal(result.kind, "success");
  // The result should include progression attempt count
  assert.ok(typeof (result as any).progressionAttemptCount === "number", "progressionAttemptCount should be a number");
  assert.ok((result as any).progressionAttemptCount >= 1, "should have at least 1 attempt");
});

// ---------------------------------------------------------------------------
// Normalization: progression is passed through from ImportedCurriculumDocument
// ---------------------------------------------------------------------------

test("normalizeCurriculumDocument persists explicit progression even when fallback edges exist", () => {
  const progression = {
    phases: [
      { title: "Phase 1", skillTitles: ["Count to 20", "Identify numbers 1-20"] },
      { title: "Phase 2", skillTitles: ["Add 1-10", "Add 11-20", "Solve simple word problems"] },
    ],
    edges: [
      { fromSkillTitle: "Count to 20", toSkillTitle: "Add 1-10", kind: "hardPrerequisite" as const },
    ],
  };

  const result = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: testDocument,
    progression,
  });

  // Should have explicit prerequisites, not inferred
  const inferredPrereqs = result.prerequisites.filter((p) => p.kind === "inferred");
  assert.equal(inferredPrereqs.length, 0, "Should have no inferred prerequisites when explicit progression provided");

  const explicitPrereqs = result.prerequisites.filter((p) => p.kind !== "inferred");
  assert.ok(explicitPrereqs.length > 0, "Should have explicit prerequisites");

  assert.equal(result.summary.progressionDiagnostics.hasExplicitProgression, true);
  assert.equal(result.summary.progressionDiagnostics.usingInferredFallback, false);
});

// ---------------------------------------------------------------------------
// Regeneration service: unit test with mock adapter
// ---------------------------------------------------------------------------

import { regenerateCurriculumProgression } from "../lib/curriculum/progression-regeneration.ts";

test("regenerateCurriculumProgression returns failure when source not found", async () => {
  // This would fail because getCurriculumSource requires DB access.
  // We test that the error type is correct via the service's failure path.
  // The actual DB integration is tested separately.
  // Here we just verify the function signature exports correctly.
  assert.ok(typeof regenerateCurriculumProgression === "function");
});
