import assert from "node:assert/strict";
import test from "node:test";

import { runCurriculumRevisionDecision } from "../lib/curriculum/revision-model.ts";
import {
  buildCurriculumRevisionPrompt,
  type CurriculumRevisionPromptSnapshot,
} from "../lib/prompts/curriculum-draft.ts";

const baseSnapshot = {
  source: {
    id: "source-1",
    title: "Board Games",
    description: "A curriculum about chess setup and play.",
    kind: "ai_draft",
    status: "draft",
    importVersion: 1,
    subjects: ["Games"],
    gradeLevels: ["3"],
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
    "domain: Board Games",
    "domain > strand: Board Games > Setup",
    "domain > strand > goal_group: Board Games > Setup > Opening",
    "domain > strand > goal_group > skill: Board Games > Setup > Opening > Set up the board",
  ],
  structure: [
    {
      title: "Board Games",
      normalizedType: "domain",
      path: ["Board Games"],
      normalizedPath: "board-games",
      description: "Play and study board games.",
      code: undefined,
      depth: 0,
      sequenceIndex: 0,
      children: [
        {
          title: "Setup",
          normalizedType: "strand",
          path: ["Board Games", "Setup"],
          normalizedPath: "board-games/setup",
          description: "Set up games correctly.",
          code: undefined,
          depth: 1,
          sequenceIndex: 0,
          children: [
            {
              title: "Opening",
              normalizedType: "goal_group",
              path: ["Board Games", "Setup", "Opening"],
              normalizedPath: "board-games/setup/opening",
              description: "Learn the opening routine.",
              code: undefined,
              depth: 2,
              sequenceIndex: 0,
              children: [
                {
                  title: "Set up the board",
                  normalizedType: "skill",
                  path: ["Board Games", "Setup", "Opening", "Set up the board"],
                  normalizedPath: "board-games/setup/opening/set-up-the-board",
                  description: "Place every piece in the starting position.",
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
      description: "Setup and opening play.",
      estimatedWeeks: 2,
      estimatedSessions: 8,
      lessons: [
        {
          title: "Opening setup",
          description: "Learn the board layout.",
          subject: "Games",
          estimatedMinutes: 30,
          materials: ["Board", "Pieces"],
          objectives: ["Set up the board"],
          linkedSkillTitles: ["Set up the board"],
        },
        {
          title: "First moves",
          description: "Practice opening routines.",
          subject: "Games",
          estimatedMinutes: 30,
          materials: ["Board", "Pieces"],
          objectives: ["Set up the board"],
          linkedSkillTitles: ["Set up the board"],
        },
      ],
    },
  ],
} satisfies CurriculumRevisionPromptSnapshot;

function createSplitArtifact() {
  return {
    source: {
      title: "Board Games Setup",
      description: "A narrow split of the original setup branch.",
      subjects: ["Games"],
      gradeLevels: ["3"],
      academicYear: "2025-2026",
      summary: "The curriculum now separates board placement from piece placement.",
      teachingApproach: "Keep the structure intact while splitting the setup skill into siblings.",
      successSignals: [
        "The setup branch is visibly split into sibling skills.",
        "Lessons still point at the same surrounding structure.",
      ],
      parentNotes: ["Preserve the rest of the tree."],
      rationale: ["This is a narrow revision."],
    },
    intakeSummary: "Split the board setup skill.",
    pacing: {
      totalWeeks: 2,
      sessionsPerWeek: 4,
      sessionMinutes: 30,
      totalSessions: 8,
      coverageStrategy: "Preserve the existing pacing.",
      coverageNotes: ["Only the requested branch changed."],
    },
    document: {
      "Board Games": {
        Setup: {
          Opening: ["Set up the board", "Set up each piece"],
        },
      },
    },
    units: [
      {
        title: "Unit 1",
        description: "Setup and opening play.",
        estimatedWeeks: 2,
        estimatedSessions: 8,
        lessons: [
          {
            title: "Opening setup",
            description: "Learn the board layout.",
            subject: "Games",
            estimatedMinutes: 30,
            materials: ["Board", "Pieces"],
            objectives: ["Set up the board"],
            linkedSkillTitles: ["Set up the board", "Set up each piece"],
          },
          {
            title: "First moves",
            description: "Practice opening routines.",
            subject: "Games",
            estimatedMinutes: 30,
            materials: ["Board", "Pieces"],
            objectives: ["Set up the board"],
            linkedSkillTitles: ["Set up the board", "Set up each piece"],
          },
        ],
      },
    ],
  };
}

test("revision prompt includes the rich snapshot and instructions", () => {
  const prompt = buildCurriculumRevisionPrompt({
    learnerName: "Ava",
    currentCurriculum: baseSnapshot,
    currentRequest: "split the board skill into setting up the board and setting up each piece",
    messages: [
      { role: "user", content: "split the board skill into setting up the board and setting up each piece" },
    ],
    correctionNotes: ["Return valid JSON matching the schema."],
  });

  assert.match(prompt, /Current curriculum snapshot:/);
  assert.match(prompt, /"normalizedType": "domain"/);
  assert.match(prompt, /"path": \[\s*"Board Games"/);
  assert.match(prompt, /Current structure summary:/);
  assert.match(prompt, /Revision instructions:/);
  assert.match(prompt, /Preserve unchanged branches unless the parent explicitly asked for a broader rewrite\./);
  assert.match(prompt, /Retry correction notes:/);
  assert.doesNotMatch(prompt, /Likely target matches:/);
  assert.doesNotMatch(prompt, /Revision plan:/);
});

test("model-owned split artifacts are returned without local synthesis", async () => {
  const calls = [];
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const result = await runCurriculumRevisionDecision({
    learnerName: "Ava",
    messages: [
      {
        role: "user",
        content: "split the board skill into setting up the board and setting up each piece",
      },
    ],
    snapshot: baseSnapshot,
    model: "mock-model",
    systemPrompt: "system prompt",
    completeJson: async (options) => {
      calls.push({ attempt: calls.length + 1, prompt: options.messages[0].content });
      return {
        assistantMessage: "Split applied.",
        action: "apply",
        changeSummary: ["Split the board setup skill into smaller siblings."],
        artifact: createSplitArtifact(),
      };
    },
    logger,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].prompt, /Current curriculum snapshot:/);
  assert.equal(result.action, "apply");
  assert.equal(result.artifact?.source.title, "Board Games Setup");
  assert.deepEqual(result.artifact?.document, createSplitArtifact().document);
  assert.deepEqual(result.artifact?.units[0].lessons[0].linkedSkillTitles, [
    "Set up the board",
    "Set up each piece",
  ]);
});

test("invalid model output retries once and then clarifies", async () => {
  const calls = [];
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const result = await runCurriculumRevisionDecision({
    learnerName: "Ava",
    messages: [
      {
        role: "user",
        content: "split the board skill into setting up the board and setting up each piece",
      },
    ],
    snapshot: baseSnapshot,
    model: "mock-model",
    systemPrompt: "system prompt",
    completeJson: async (options) => {
      calls.push(options.messages[0].content);
      return {};
    },
    logger,
  });

  assert.equal(calls.length, 2);
  assert.match(calls[1], /Retry correction notes:/);
  assert.equal(result.action, "clarify");
  assert.equal(result.changeSummary.length, 1);
  assert.match(result.assistantMessage, /valid revision/i);
});
