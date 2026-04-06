import assert from "node:assert/strict";
import test from "node:test";

import { buildFallbackChatTurn } from "../lib/curriculum/ai-draft-service.ts";
import { normalizeCurriculumDocument } from "../lib/curriculum/normalization.ts";
import {
  CURRICULUM_CORE_SYSTEM_PROMPT as CURRICULUM_GENERATION_SYSTEM_PROMPT,
  buildCurriculumCorePrompt as buildCurriculumGenerationPrompt,
} from "../lib/prompts/curriculum-draft.ts";
import {
  inferCurriculumGranularityProfile,
  buildGranularityGuidance,
} from "../lib/curriculum/granularity.ts";
import {
  extractRequestedSubjectLabel,
  normalizeCurriculumLabel,
} from "../lib/curriculum/labels.ts";
import { assessCurriculumArtifactQuality } from "../lib/curriculum/quality.ts";

const noviceRequirements = {
  topic: "ecosystems",
  goals: "Understand how living things interact in a food web",
  timeframe: "8 weeks, 2 short sessions per week",
  learnerProfile: "young beginner who needs step-by-step support and short sessions",
  constraints: "keep prep light and use short lessons",
  teachingStyle: "hands-on, guided practice",
  assessment: "visible checks and short explanations",
  structurePreferences: "skill progression",
} as const;

const advancedRequirements = {
  topic: "ecosystems",
  goals: "Connect ecological ideas across examples and transfer them to new contexts",
  timeframe: "12 weeks, 4 sessions per week, 45 minutes",
  learnerProfile: "experienced learner who is confident, fluent, and ready for deeper integration",
  constraints: "can handle longer sessions and more independent work",
  teachingStyle: "discussion, synthesis, and application",
  assessment: "projects, explanations, and evidence of transfer",
  structurePreferences: "integrated progression",
} as const;

test("generation prompt guidance emphasizes teachable granularity instead of compactness", () => {
  assert.match(CURRICULUM_GENERATION_SYSTEM_PROMPT, /Do not optimize for minimal node count\./);
  assert.match(CURRICULUM_GENERATION_SYSTEM_PROMPT, /Multiple goal groups per strand are fine/);
  assert.match(CURRICULUM_GENERATION_SYSTEM_PROMPT, /roughly 1-3 short sessions/);
  assert.doesNotMatch(CURRICULUM_GENERATION_SYSTEM_PROMPT, /Keep the tree compact/);

  const prompt = buildCurriculumGenerationPrompt({
    learnerName: "Ava",
    messages: [{ role: "user", content: "Build an ecosystems curriculum." }],
    requirementHints: noviceRequirements,
    pacingExpectations: { totalWeeks: 8, sessionsPerWeek: 2, sessionMinutes: 20 },
    granularityGuidance: buildGranularityGuidance(
      inferCurriculumGranularityProfile({
        topic: noviceRequirements.topic,
        requirements: noviceRequirements,
        pacing: {
          totalWeeks: 8,
          sessionsPerWeek: 2,
          sessionMinutes: 20,
        },
      }),
    ),
  });

  assert.match(prompt, /Granularity guidance:/);
  assert.match(prompt, /Do not optimize for minimal node count/);
  assert.match(prompt, /smallest teachable unit/);
});

test("granularity helper narrows novice short-session learners and broadens experienced long-session learners", () => {
  const novice = inferCurriculumGranularityProfile({
    topic: noviceRequirements.topic,
    requirements: noviceRequirements,
    pacing: {
      totalWeeks: 8,
      sessionsPerWeek: 2,
      sessionMinutes: 20,
      explicitlyRequestedTotalSessions: 16,
    },
  });
  const advanced = inferCurriculumGranularityProfile({
    topic: advancedRequirements.topic,
    requirements: advancedRequirements,
    pacing: {
      totalWeeks: 12,
      sessionsPerWeek: 4,
      sessionMinutes: 45,
      explicitlyRequestedTotalSessions: 48,
    },
  });

  assert.equal(novice.mode, "narrow");
  assert.equal(advanced.mode, "broad");
  assert.ok(novice.preferredSkillCount > advanced.preferredSkillCount);
  assert.ok(novice.maxSessionsPerSkill < advanced.maxSessionsPerSkill);
});

test("topic extraction keeps labels short and subject-focused", () => {
  const label = extractRequestedSubjectLabel(
    "I want a 10 week curriculum for my 4th grader to study botany and plant structure with short sessions and hands-on work.",
  );

  assert.equal(label, "botany and plant structure");
  assert.ok(label && label.split(/\s+/).length <= 5);
  assert.doesNotMatch(label ?? "", /\b(curriculum|plan|session|sessions|learner|grader)\b/i);
});

test("label normalization removes wrapper noise without inventing new content", () => {
  assert.equal(normalizeCurriculumLabel("  1.  Plant Structure  "), "Plant Structure");
  assert.equal(normalizeCurriculumLabel("Goal: ecosystems"), "ecosystems");
});

test("intake fallback still asks a safe question when nothing is known", () => {
  const turn = buildFallbackChatTurn({
    learner: {
      firstName: "Lina",
      displayName: "Lina",
    },
    messages: [],
  });

  assert.equal(turn.state.readiness, "gathering");
  assert.match(turn.assistantMessage, /What are you hoping to build/i);
});

test("quality checks flag overly broad skills and missing visible assessment", () => {
  const broadArtifact = {
    source: {
      title: "Ecosystems Study Sequence",
      description: "A very broad curriculum about ecosystems.",
      subjects: ["science"],
      gradeLevels: ["4"],
      summary: "Learn everything about ecosystems in one pass.",
      teachingApproach: "Read and discuss the topic.",
      successSignals: ["The learner knows the topic."],
      parentNotes: ["Keep going until it feels finished."],
      rationale: ["Broad topic coverage."],
    },
    intakeSummary: "Broad ecosystems curriculum.",
    pacing: {
      totalWeeks: 8,
      sessionsPerWeek: 2,
      sessionMinutes: 20,
      totalSessions: 16,
      coverageStrategy: "Cover the topic.",
      coverageNotes: ["Go through the content."],
    },
    document: {
      "Ecosystems Study Sequence": {
        "All of ecosystems": {
          "Food webs, habitats, cycles, and adaptations": [
            "Understand, compare, and apply everything about ecosystems",
          ],
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

  const issues = assessCurriculumArtifactQuality(broadArtifact, {
    topicText: "ecosystems",
    granularity: inferCurriculumGranularityProfile({
      topic: "ecosystems",
      requirements: noviceRequirements,
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

test("normalization preserves compressed source lineage for deeper imported trees", () => {
  const normalized = normalizeCurriculumDocument({
    sourceId: "source-1",
    sourceLineageId: "lineage-1",
    document: {
      Botany: {
        "Plant structure": {
          "Leaf anatomy": {
            "Shape study": {
              "Compare leaf shapes": "Describe leaf types and how they differ.",
            },
          },
        },
      },
    },
  });

  const goalGroup = normalized.nodes.find((node) => node.normalizedType === "goal_group");
  const skill = normalized.nodes.find((node) => node.normalizedType === "skill");

  assert.ok(goalGroup);
  assert.equal(goalGroup?.metadata.compressedStructure?.compressedTitle, "Leaf anatomy / Shape study");
  assert.deepEqual(goalGroup?.metadata.compressedStructure?.compressedSegments, [
    "Leaf anatomy",
    "Shape study",
  ]);
  assert.ok(Array.isArray(goalGroup?.metadata.compressedSegments));
  assert.ok(goalGroup?.sourcePayload.compressedStructure);
  assert.ok(Array.isArray(skill?.metadata.rawPath));
  assert.equal((skill?.sourcePayload.rawDepth as number) >= 2, true);
});
