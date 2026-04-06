import assert from "node:assert/strict";
import test from "node:test";

import {
  generateCurriculumArtifact,
  parseCurriculumProgression,
} from "../lib/curriculum/ai-draft-service.ts";
// import { CurriculumAiProgressionSchema } from "../lib/curriculum/ai-draft.ts";

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

test("generateCurriculumArtifact performs two passes and merges progression", async () => {
  let callCount = 0;
  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt as any,
      complete: async ({ systemPrompt }) => {
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

/*
test("parseCurriculumProgression validates schema", () => {
  const valid = makeValidProgression();
  const result = parseCurriculumProgression(JSON.stringify(valid));
  assert.equal(result.kind, "success");
  assert.equal(result.progression.phases[0].title, "Phase 1");

  const invalid = { phases: [{ title: "Phase 1", skillTitles: [] }] }; // skillTitles must be min(1)
  const result2 = parseCurriculumProgression(JSON.stringify(invalid));
  assert.equal(result2.kind, "schema_failure");
});

test("CurriculumAiProgressionSchema defaults to empty arrays", () => {
  const result = CurriculumAiProgressionSchema.parse({});
  assert.deepEqual(result.phases, []);
  assert.deepEqual(result.edges, []);
});
*/
