import assert from "node:assert/strict";
import test from "node:test";

import {
  generateCurriculumArtifact,
  parseCurriculumProgression,
} from "../lib/curriculum/ai-draft-service.ts";
import {
  validateProgressionSemantics,
} from "../lib/curriculum/progression-validation.ts";
import { normalizeCurriculumDocument } from "../lib/curriculum/normalization.ts";
import { getModelForTask } from "../lib/ai/provider-adapter.ts";
import { getAiRoutingConfig } from "../lib/ai/routing.ts";

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

test("getModelForTask returns explicit model for progression tasks", () => {
  const progressionModel = getModelForTask("curriculum.generate.progression", getAiRoutingConfig());
  assert.ok(progressionModel !== undefined);
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
