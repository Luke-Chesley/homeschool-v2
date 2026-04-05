import assert from "node:assert/strict";
import test from "node:test";

import {
  createCurriculumFromConversation,
  generateCurriculumArtifact,
  reviseCurriculumFromConversation,
} from "../lib/curriculum/ai-draft-service.ts";
import { inferCurriculumGranularityProfile } from "../lib/curriculum/granularity.ts";
import { assessCurriculumArtifactQuality } from "../lib/curriculum/quality.ts";
import { runCurriculumRevisionDecision } from "../lib/curriculum/revision-model.ts";

const learner = {
  firstName: "Ava",
  displayName: "Ava",
};

const messages = [
  {
    role: "user" as const,
    content: "Build an ecosystems curriculum for a 4th grader who needs short lessons.",
  },
];

const revisionSnapshot = {
  source: {
    id: "source-1",
    title: "Ecosystems",
    description: "A science curriculum about ecosystems.",
    kind: "ai_draft",
    status: "draft",
    importVersion: 1,
    subjects: ["science"],
    gradeLevels: ["4"],
    academicYear: "2025-2026",
  },
  counts: {
    nodeCount: 4,
    skillCount: 1,
    unitCount: 1,
    lessonCount: 2,
    estimatedSessionCount: 8,
  },
  pacing: {
    totalEstimatedSessions: 8,
    unitSessionBudgets: [{ unitTitle: "Unit 1", estimatedSessions: 8 }],
  },
  structureSummary: [
    "domain: Ecosystems",
    "domain > strand: Ecosystems > Core ideas",
    "domain > strand > goal_group: Ecosystems > Core ideas > Food webs",
    "domain > strand > goal_group > skill: Ecosystems > Core ideas > Food webs > Understand food webs",
  ],
  structure: [
    {
      title: "Ecosystems",
      normalizedType: "domain",
      path: ["Ecosystems"],
      normalizedPath: "domain:ecosystems",
      description: "Science curriculum about ecosystems.",
      code: undefined,
      depth: 0,
      sequenceIndex: 0,
      children: [
        {
          title: "Core ideas",
          normalizedType: "strand",
          path: ["Ecosystems", "Core ideas"],
          normalizedPath: "domain:ecosystems/strand:core-ideas",
          description: "Core ecosystem ideas.",
          code: undefined,
          depth: 1,
          sequenceIndex: 0,
          children: [
            {
              title: "Food webs",
              normalizedType: "goal_group",
              path: ["Ecosystems", "Core ideas", "Food webs"],
              normalizedPath: "domain:ecosystems/strand:core-ideas/goal_group:food-webs",
              description: "Understand food webs.",
              code: undefined,
              depth: 2,
              sequenceIndex: 0,
              children: [
                {
                  title: "Understand food webs",
                  normalizedType: "skill",
                  path: ["Ecosystems", "Core ideas", "Food webs", "Understand food webs"],
                  normalizedPath:
                    "domain:ecosystems/strand:core-ideas/goal_group:food-webs/skill:understand-food-webs",
                  description: "Describe basic food webs.",
                  code: undefined,
                  depth: 3,
                  sequenceIndex: 0,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  outline: [
    {
      title: "Unit 1",
      description: "Introductory ecosystems work.",
      estimatedWeeks: 2,
      estimatedSessions: 8,
      lessons: [
        {
          title: "Food webs",
          description: "Learn the basic food web.",
          subject: "science",
          estimatedMinutes: 30,
          materials: ["notes"],
          objectives: ["Show a basic food web"],
          linkedSkillTitles: ["Understand food webs"],
        },
      ],
    },
  ],
} as const;

const stubPrompt = async () => ({
  id: "test-prompt",
  task: "curriculum.generate",
  version: "1.0.0",
  systemPrompt: "stub system prompt",
  userTemplate: undefined,
  notes: undefined,
});

function makeValidArtifact() {
  return {
    source: {
      title: "Ecosystems",
      description: "A science curriculum about ecosystems.",
      subjects: ["science"],
      gradeLevels: ["4"],
      summary: "Build a strong understanding of ecosystems.",
      teachingApproach: "Use short lessons with visible checks.",
      successSignals: ["The learner can explain a food web."],
      parentNotes: ["Keep lessons short."],
      rationale: ["The topic is science and needs observable practice."],
    },
    intakeSummary: "Ecosystems curriculum for a 4th grader.",
    pacing: {
      totalWeeks: 8,
      sessionsPerWeek: 2,
      sessionMinutes: 20,
      totalSessions: 16,
      coverageStrategy: "Use a steady teach-practice-check rhythm.",
      coverageNotes: ["Keep the work visible."],
    },
    document: {
      Ecosystems: {
        "Core ideas": {
          "Food webs": ["Understand food webs"],
        },
      },
    },
    units: [
      {
        title: "Unit 1",
        description: "Introductory ecosystems work.",
        estimatedWeeks: 2,
        estimatedSessions: 8,
        lessons: [
          {
            title: "Food webs",
            description: "Learn the basic food web.",
            subject: "science",
            estimatedMinutes: 20,
            materials: ["notes"],
            objectives: ["Show a basic food web"],
            linkedSkillTitles: ["Understand food webs"],
          },
        ],
      },
    ],
  };
}

function makeBroadArtifact() {
  return {
    source: {
      title: "Ecosystems",
      description: "A science curriculum about ecosystems.",
      subjects: ["science"],
      gradeLevels: ["4"],
      summary: "Cover everything about ecosystems.",
      teachingApproach: "Use a broad overview.",
      successSignals: ["The learner understands ecosystems."],
      parentNotes: ["Keep it broad."],
      rationale: ["One broad topic."],
    },
    intakeSummary: "Broad ecosystems curriculum.",
    pacing: {
      totalWeeks: 8,
      sessionsPerWeek: 2,
      sessionMinutes: 20,
      totalSessions: 16,
      coverageStrategy: "Cover the topic.",
      coverageNotes: ["Move quickly."],
    },
    document: {
      Ecosystems: {
        "Core ideas": {
          "Food webs and habitats and cycles": ["Understand, compare, and apply everything about ecosystems"],
        },
      },
    },
    units: [
      {
        title: "Unit 1",
        description: "One broad unit.",
        estimatedWeeks: 8,
        estimatedSessions: 16,
        lessons: [
          {
            title: "Overview",
            description: "Learn the whole topic.",
            subject: "science",
            estimatedMinutes: 20,
            materials: ["notes"],
            objectives: [],
            linkedSkillTitles: ["Understand, compare, and apply everything about ecosystems"],
          },
        ],
      },
    ],
  };
}

test("generation provider failure returns a structured failure result", async () => {
  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt,
      complete: async () => {
        throw new Error("provider offline");
      },
    },
  );

  assert.equal(result.kind, "failure");
  assert.equal(result.stage, "generation");
  assert.equal(result.attemptCount, 2);
  assert.equal(result.retryable, true);
  assert.match(result.userSafeMessage, /valid curriculum/i);
  assert.ok(result.issues.some((issue) => issue.code === "model_error"));
});

test("generation parse failure returns a structured failure result", async () => {
  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt,
      complete: async () => ({ content: "not json" }),
    },
  );

  assert.equal(result.kind, "failure");
  assert.equal(result.stage, "parse");
  assert.equal(result.attemptCount, 2);
  assert.ok(result.issues.some((issue) => issue.code === "parse_failed"));
});

test("generation schema failure returns a structured failure result", async () => {
  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt,
      complete: async () => ({ content: JSON.stringify({ source: { title: "Ecosystems" } }) }),
    },
  );

  assert.equal(result.kind, "failure");
  assert.equal(result.stage, "schema");
  assert.equal(result.attemptCount, 2);
  assert.ok(result.issues.some((issue) => issue.code === "schema_failed"));
});

test("generation quality failure returns a structured failure result", async () => {
  const artifact = makeBroadArtifact();
  const result = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt,
      complete: async () => ({ content: JSON.stringify(artifact) }),
    },
  );

  assert.equal(result.kind, "failure");
  assert.equal(result.stage, "quality");
  assert.equal(result.attemptCount, 2);
  assert.ok(result.issues.some((issue) => issue.code === "skill_atomicity"));
});

test("generation failure does not call persistence", async () => {
  let persistCalls = 0;
  const failure = await generateCurriculumArtifact(
    { learner, messages },
    {
      resolvePrompt: stubPrompt,
      complete: async () => {
        throw new Error("provider offline");
      },
    },
  );

  const result = await createCurriculumFromConversation(
    {
      householdId: "house-1",
      learner,
      messages,
    },
    {
      generate: async () => failure,
      persist: async () => {
        persistCalls += 1;
        throw new Error("should not persist");
      },
    },
  );

  assert.equal(result.kind, "failure");
  assert.equal(persistCalls, 0);
});

test("revision failure returns a structured failure result", async () => {
  const result = await runCurriculumRevisionDecision({
    learnerName: learner.displayName,
    messages: [
      { role: "user", content: "split the food web skill" },
    ],
    snapshot: revisionSnapshot,
    model: "mock-model",
    systemPrompt: "system prompt",
    completeJson: async () => ({}),
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  });

  assert.equal(result.kind, "failure");
  assert.equal(result.stage, "schema");
  assert.equal(result.attemptCount, 2);
  assert.ok(result.issues.length > 0);
});

test("revision failure does not call persistence", async () => {
  let persistCalls = 0;

  const result = await reviseCurriculumFromConversation(
    {
      householdId: "house-1",
      sourceId: "source-1",
      learner,
      messages: [{ role: "user", content: "split the food web skill" }],
    },
    {
      loadSnapshot: async () => revisionSnapshot,
      decide: async () => ({
        kind: "failure",
        stage: "revision",
        reason: "revision_failed",
        userSafeMessage: "I could not apply the revision safely.",
        issues: [],
        attemptCount: 2,
        retryable: true,
      }),
      persist: async () => {
        persistCalls += 1;
        throw new Error("should not persist");
      },
    },
  );

  assert.equal(result.kind, "failure");
  assert.equal(persistCalls, 0);
});

test("quality checks flag overly broad skills and missing visible assessment", () => {
  const broadArtifact = makeBroadArtifact();
  const issues = assessCurriculumArtifactQuality(broadArtifact, {
    topicText: "ecosystems",
    requestText: "Build an ecosystems curriculum for a 4th grader who needs short lessons.",
    granularity: inferCurriculumGranularityProfile({
      topic: "ecosystems",
      requirements: {
        topic: "ecosystems",
        goals: "understand ecosystems",
        timeframe: "",
        learnerProfile: "young beginner",
        constraints: "",
        teachingStyle: "",
        assessment: "",
        structurePreferences: "",
      },
      pacing: {
        totalWeeks: 8,
        sessionsPerWeek: 2,
        sessionMinutes: 20,
        explicitlyRequestedTotalSessions: 16,
      },
    }),
    requestedPacing: {
      totalWeeks: 8,
      sessionsPerWeek: 2,
      sessionMinutes: 20,
      explicitlyRequestedTotalSessions: 16,
    },
    learnerText: "young beginner",
  });

  const codes = new Set(issues.map((issue) => issue.code));

  assert.ok(codes.has("skill_atomicity"));
  assert.ok(codes.has("assessment_visibility"));
  assert.ok(codes.has("teachability"));
  assert.ok(codes.has("practice_balance"));
});
