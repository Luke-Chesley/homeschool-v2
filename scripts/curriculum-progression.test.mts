import assert from "node:assert/strict";
import test from "node:test";

import {
  generateCurriculumArtifact,
  generateCurriculumProgression,
  parseCurriculumProgression,
} from "../lib/curriculum/ai-draft-service.ts";
import {
  validateProgressionSemantics,
} from "../lib/curriculum/progression-validation.ts";
import {
  sanitizeSkillRef,
  sanitizeProgressionRefs,
} from "../lib/curriculum/progression-sanitization.ts";
import { normalizeCurriculumDocument } from "../lib/curriculum/normalization.ts";
import { getAiRoutingConfig, getModelForTask } from "../lib/ai/provider-adapter.ts";

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
      }
    ],
  };
}

function makeValidProgression() {
  return {
    progression: {
      phases: [
        {
          title: "Phase 1: Counting",
          skillRefs: ["skill_0", "skill_1"],
        },
        {
          title: "Phase 2: Addition",
          skillRefs: ["skill_2", "skill_3", "skill_4"],
        },
      ],
      edges: [
        {
          fromSkillRef: "skill_0",
          toSkillRef: "skill_2",
          kind: "hardPrerequisite",
        },
        {
          fromSkillRef: "skill_2",
          toSkillRef: "skill_3",
          kind: "hardPrerequisite",
        },
      ],
    },
  };
}

test("routing config includes progression tasks", () => {
  assert.ok(
    getAiRoutingConfig().taskDefaults["curriculum.generate.progression"],
  );
});

test("getModelForTask returns a learning-core managed route for progression tasks", () => {
  const progressionModel = getModelForTask("curriculum.generate.progression", getAiRoutingConfig());
  assert.ok(progressionModel.startsWith("learning-core/"));
});

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

test("parseCurriculumProgression succeeds on valid progression", () => {
  const valid = makeValidProgression();
  const result = parseCurriculumProgression(JSON.stringify(valid));
  assert.equal(result.kind, "success");
});

test("parseCurriculumProgression fails on empty skillRefs array", () => {
  const invalid = {
    progression: {
      phases: [{ title: "Phase 1", skillRefs: [] }],
      edges: [],
    },
  };
  const result = parseCurriculumProgression(JSON.stringify(invalid));
  assert.equal(result.kind, "schema_failure");
});

const leafSkillRefs = ["skill_0", "skill_1", "skill_2", "skill_3", "skill_4"];

test("validateProgressionSemantics accepts a valid progression", () => {
  const result = validateProgressionSemantics(makeValidProgression().progression, leafSkillRefs);
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.summary.skillsInCurriculum, 5);
});

test("validateProgressionSemantics rejects unresolved edge endpoints", () => {
  const progression = {
    phases: [{ title: "Phase 1", skillRefs: ["skill_0"] }],
    edges: [
      {
        fromSkillRef: "skill_invalid",
        toSkillRef: "skill_2",
        kind: "hardPrerequisite" as const,
      },
    ],
  };
  const result = validateProgressionSemantics(progression, leafSkillRefs);
  assert.ok(result.issues.some((issue) => issue.code === "unresolved_edge_from"));
});

test("normalizeCurriculumDocument uses explicit progression properly", () => {
  const result = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: makeValidCore().document,
  });

  const skillIds = result.nodes.filter(n => n.normalizedType === "skill").map(n => n.id);

  const progression = {
    phases: [
      { title: "Phase 1", skillRefs: [skillIds[0], skillIds[1]] },
    ],
    edges: [
      { fromSkillRef: skillIds[0], toSkillRef: skillIds[1], kind: "hardPrerequisite" as const },
    ],
  };

  const result2 = normalizeCurriculumDocument({
    sourceId: "src-1",
    sourceLineageId: "lineage-1",
    document: makeValidCore().document,
    progression,
  });

  assert.equal(result2.summary.progressionDiagnostics.hasExplicitProgression, true);
  assert.equal(result2.prerequisites.length, 1);
});

// ── New tests for observed failure modes ──────────────────────────────────────

test("parseCurriculumProgression: pure non-JSON output returns parse_failure with no_json_found", () => {
  const nonJson = "Sure! Here's the progression for your curriculum.";
  const result = parseCurriculumProgression(nonJson);
  assert.equal(result.kind, "parse_failure");
  if (result.kind === "parse_failure") {
    assert.equal(result.parseFailureKind, "no_json_found");
  }
});

test("parseCurriculumProgression: prose wrapping valid JSON still succeeds", () => {
  const withProse = `Here is the progression:\n\n${JSON.stringify(makeValidProgression())}\n\nLet me know if you need changes.`;
  const result = parseCurriculumProgression(withProse);
  assert.equal(result.kind, "success");
});

test("parseCurriculumProgression: malformed JSON object returns parse_failure with malformed_json", () => {
  const malformed = `{ "progression": { "phases": [{ "title": "Phase 1", "skillRefs": ["s1"}, `;
  const result = parseCurriculumProgression(malformed);
  assert.equal(result.kind, "parse_failure");
  if (result.kind === "parse_failure") {
    assert.equal(result.parseFailureKind, "malformed_json");
  }
});

test("sanitizeSkillRef: collapses cnode_cnode_* double prefix", () => {
  const r = sanitizeSkillRef("cnode_cnode_e2093ac4");
  assert.equal(r.sanitizedRef, "cnode_e2093ac4");
  assert.equal(r.changed, true);
  assert.equal(r.originalRef, "cnode_cnode_e2093ac4");
});

test("sanitizeSkillRef: no change when ref is already correct", () => {
  const r = sanitizeSkillRef("cnode_e2093ac4");
  assert.equal(r.sanitizedRef, "cnode_e2093ac4");
  assert.equal(r.changed, false);
});

test("sanitizeSkillRef: collapses skill_skill_* double prefix", () => {
  const r = sanitizeSkillRef("skill_skill_abc123");
  assert.equal(r.sanitizedRef, "skill_abc123");
  assert.equal(r.changed, true);
});

test("sanitizeSkillRef: trims whitespace", () => {
  const r = sanitizeSkillRef("  cnode_abc  ");
  assert.equal(r.sanitizedRef, "cnode_abc");
  assert.equal(r.changed, true);
});

test("sanitizeProgressionRefs: corrects double-prefix in phases and edges", () => {
  const progression = {
    phases: [
      { title: "Phase 1", skillRefs: ["cnode_cnode_aaa", "cnode_bbb"] },
    ],
    edges: [
      {
        fromSkillRef: "cnode_cnode_aaa",
        toSkillRef: "cnode_bbb",
        kind: "hardPrerequisite" as const,
      },
    ],
  };
  const { sanitized, anyChanged, results } = sanitizeProgressionRefs(progression);
  assert.equal(anyChanged, true);
  assert.equal(sanitized.phases[0].skillRefs[0], "cnode_aaa");
  assert.equal(sanitized.phases[0].skillRefs[1], "cnode_bbb");
  assert.equal(sanitized.edges[0].fromSkillRef, "cnode_aaa");
  const changedResults = results.filter(r => r.changed);
  assert.equal(changedResults.length, 2); // two occurrences of cnode_cnode_aaa
});

test("validateProgressionSemantics: missing 4 of 23 skills causes hard failure with incomplete_phase_coverage", () => {
  const skillRefs = Array.from({ length: 23 }, (_, i) => `skill_${i}`);
  const assignedSkills = skillRefs.slice(0, 19); // only 19 of 23 assigned

  const progression = {
    phases: [
      { title: "Phase 1", skillRefs: assignedSkills.slice(0, 10) },
      { title: "Phase 2", skillRefs: assignedSkills.slice(10) },
    ],
    edges: [],
  };

  const result = validateProgressionSemantics(progression, skillRefs);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "incomplete_phase_coverage"));
  assert.equal(result.missingSkillRefs.length, 4);
  assert.equal(result.summary.skillsAssignedToPhases, 19);
  assert.equal(result.summary.skillsInCurriculum, 23);
});

test("validateProgressionSemantics: duplicate phase assignment causes hard failure", () => {
  const result = validateProgressionSemantics(
    {
      phases: [
        { title: "Phase 1", skillRefs: ["skill_0", "skill_1"] },
        { title: "Phase 2", skillRefs: ["skill_1", "skill_2", "skill_3", "skill_4"] }, // skill_1 duplicated
      ],
      edges: [],
    },
    leafSkillRefs,
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "duplicate_phase_assignment"));
  assert.ok(result.duplicateAssignedSkillRefs.includes("skill_1"));
});

test("validateProgressionSemantics: typoed ref is blocked even after sanitization removes double-prefix", () => {
  // A ref that looks like a typo (wrong characters, not just double prefix) must stay blocked.
  const result = validateProgressionSemantics(
    {
      phases: [
        { title: "Phase 1", skillRefs: ["skill_22093ac4", "skill_1fb18f"] }, // wrong IDs
        { title: "Phase 2", skillRefs: ["skill_2", "skill_3", "skill_4"] },
      ],
      edges: [],
    },
    leafSkillRefs, // valid refs are skill_0..skill_4
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "unresolved_phase_skill"));
  assert.ok(result.invalidPhaseSkillRefs.includes("skill_22093ac4"));
});

test("validateProgressionSemantics: zero missing skills → no incomplete_phase_coverage issue", () => {
  // All 5 skills assigned → no coverage issue.
  const result = validateProgressionSemantics(makeValidProgression().progression, leafSkillRefs);
  assert.equal(result.valid, true);
  assert.equal(result.missingSkillRefs.length, 0);
  assert.ok(!result.issues.some((i) => i.code === "incomplete_phase_coverage"));
});

test("generateCurriculumProgression: draft with 19/23 skills assigned is rejected, not accepted", async () => {
  const skillRefs = Array.from({ length: 23 }, (_, i) => ({
    skillId: `cnode_${i.toString().padStart(4, "0")}`,
    skillTitle: `Skill ${i}`,
  }));

  // Return a draft that only assigns 19/23 skills.
  const incompleteDraft = {
    progression: {
      phases: [
        { title: "Phase 1", skillRefs: skillRefs.slice(0, 10).map((r) => r.skillId) },
        { title: "Phase 2", skillRefs: skillRefs.slice(10, 19).map((r) => r.skillId) },
        // skills 19-22 are missing
      ],
      edges: [],
    },
  };

  // Repair attempt also returns incomplete draft.
  let callCount = 0;
  const result = await generateCurriculumProgression(
    {
      learner: { displayName: "Test" },
      artifact: {
        source: { title: "Test Curriculum", description: "", subjects: [], gradeLevels: [], summary: "", teachingApproach: "", successSignals: [], parentNotes: [], rationale: [] },
        intakeSummary: "",
        pacing: { coverageStrategy: "", coverageNotes: [] },
        document: {},
        units: [],
      },
      skillRefs,
    },
    {
      resolvePrompt: stubPrompt as any,
      complete: async () => {
        callCount += 1;
        // Always return incomplete draft (both generation and repair attempts).
        return { content: JSON.stringify(incompleteDraft) };
      },
    },
  );

  // Must not be accepted — progression should be null after all attempts.
  assert.equal(result.progression, null);
  // All attempts should have failed with semantic errors.
  assert.ok(result.attempts.every((a) => !a.accepted));
  assert.ok(result.attempts.some((a) => a.failureCategory === "semantic"));
  // missingSkillRefs should be recorded on at least one attempt.
  assert.ok(result.attempts.some((a) => a.missingSkillRefs && a.missingSkillRefs.length === 4));
});

test("generateCurriculumProgression: repair pass accepts a draft with correctable bad refs", async () => {
  const skillRefs = [
    { skillId: "cnode_aaa", skillTitle: "Add numbers" },
    { skillId: "cnode_bbb", skillTitle: "Subtract numbers" },
    { skillId: "cnode_ccc", skillTitle: "Multiply numbers" },
  ];

  // First call returns draft with cnode_cnode_* corruption (sanitizable) but missing one skill.
  const corruptDraft = {
    progression: {
      phases: [
        { title: "Phase 1", skillRefs: ["cnode_aaa", "cnode_bbb"] },
        // cnode_ccc is missing
      ],
      edges: [],
    },
  };

  // Repair call returns a fixed draft with all skills assigned.
  const repairedDraft = {
    progression: {
      phases: [
        { title: "Phase 1", skillRefs: ["cnode_aaa", "cnode_bbb"] },
        { title: "Phase 2", skillRefs: ["cnode_ccc"] },
      ],
      edges: [],
    },
  };

  let callCount = 0;
  const result = await generateCurriculumProgression(
    {
      learner: { displayName: "Test" },
      artifact: {
        source: { title: "Math", description: "", subjects: [], gradeLevels: [], summary: "", teachingApproach: "", successSignals: [], parentNotes: [], rationale: [] },
        intakeSummary: "",
        pacing: { coverageStrategy: "", coverageNotes: [] },
        document: {},
        units: [],
      },
      skillRefs,
    },
    {
      resolvePrompt: stubPrompt as any,
      complete: async () => {
        callCount += 1;
        if (callCount === 1) return { content: JSON.stringify(corruptDraft) }; // initial attempt
        return { content: JSON.stringify(repairedDraft) }; // repair attempt
      },
    },
  );

  // Repair should have succeeded.
  assert.ok(result.progression !== null, "Expected progression to be accepted after repair");
  assert.equal(result.progression?.phases.length, 2);
  // Should have recorded a repair attempt on the first attempt.
  const attemptWithRepair = result.attempts.find((a) => a.repairAttempt?.attempted);
  assert.ok(attemptWithRepair, "Expected at least one attempt to record a repair pass");
  // accepted means: repair response received, parsed, schema valid, AND semantically valid
  assert.equal(attemptWithRepair?.repairAttempt?.accepted, true, "repairAttempt.accepted should be true when repair passed semantic validation");
});
