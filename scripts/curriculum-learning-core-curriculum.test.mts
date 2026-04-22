import test from "node:test";
import assert from "node:assert/strict";

import {
  CurriculumGenerateInputSchema,
  CurriculumRevisionInputSchema,
  CurriculumGenerateSourceEntryInputSchema,
} from "@/lib/learning-core/curriculum";

test("CurriculumGenerateInputSchema accepts a source_entry payload", () => {
  const parsed = CurriculumGenerateInputSchema.parse({
    learnerName: "Maya",
    titleCandidate: "Ancient Egypt",
    requestMode: "source_entry",
    requestedRoute: "outline",
    routedRoute: "outline",
    sourceKind: "structured_sequence",
    entryStrategy: "use_as_is",
    entryLabel: "Chapter 1",
    continuationMode: "sequential",
    deliveryPattern: "concept_first",
    recommendedHorizon: "one_week",
    sourceText: "Chapter 1: Ancient Egypt overview",
    sourcePackages: [],
    sourceFiles: [],
    detectedChunks: ["Chapter 1"],
    assumptions: ["Begin with the first chapter."],
  });

  assert.equal(parsed.requestMode, "source_entry");
  assert.equal(parsed.recommendedHorizon, "one_week");
  assert.equal(parsed.sourceText, "Chapter 1: Ancient Egypt overview");
});

test("CurriculumGenerateInputSchema rejects source-only fields on conversation_intake requests", () => {
  const parsed = CurriculumGenerateInputSchema.safeParse({
    learnerName: "Maya",
    requestMode: "conversation_intake",
    messages: [{ role: "user", content: "Build a history curriculum." }],
    sourceText: "This should not be accepted here.",
  });

  assert.equal(parsed.success, false);
});

test("CurriculumGenerateInputSchema accepts a conversation_intake payload", () => {
  const parsed = CurriculumGenerateInputSchema.parse({
    learnerName: "Maya",
    titleCandidate: "Fractions this summer",
    requestMode: "conversation_intake",
    messages: [{ role: "user", content: "Teach my son fractions this summer." }],
    granularityGuidance: ["Keep the first week teachable."],
    correctionNotes: ["Prefer visual models first."],
  });

  assert.equal(parsed.requestMode, "conversation_intake");
  assert.equal(parsed.messages.length, 1);
});

test("CurriculumGenerateInputSchema rejects route fields on conversation_intake payloads", () => {
  const parsed = CurriculumGenerateInputSchema.safeParse({
    learnerName: "Maya",
    requestMode: "conversation_intake",
    requestedRoute: "topic",
    messages: [{ role: "user", content: "Teach my son fractions this summer." }],
  });

  assert.equal(parsed.success, false);
});

test("CurriculumGenerateSourceEntryInputSchema requires non-empty sourceText", () => {
  const parsed = CurriculumGenerateSourceEntryInputSchema.safeParse({
    learnerName: "Maya",
    requestMode: "source_entry",
    requestedRoute: "outline",
    routedRoute: "outline",
    sourceKind: "structured_sequence",
    entryStrategy: "use_as_is",
    continuationMode: "sequential",
    deliveryPattern: "concept_first",
    recommendedHorizon: "one_week",
    sourceText: "   ",
    sourcePackages: [],
    sourceFiles: [],
    detectedChunks: [],
    assumptions: [],
  });

  assert.equal(parsed.success, false);
});

test("CurriculumRevisionInputSchema accepts a full curriculum artifact snapshot", () => {
  const parsed = CurriculumRevisionInputSchema.parse({
    learnerName: "Maya",
    currentCurriculum: {
      source: {
        title: "Fractions",
        description: "An introductory fractions curriculum.",
        subjects: ["Mathematics"],
        gradeLevels: ["Elementary"],
        summary: "A teachable fractions sequence.",
        teachingApproach: "Use visual models and guided practice.",
        successSignals: ["Can compare halves and quarters."],
        parentNotes: [],
        rationale: ["Keep the structure teachable."],
      },
      intakeSummary: "Parent wants a bounded fractions start.",
      pacing: {
        coverageStrategy: "Move through one unit in order.",
        coverageNotes: [],
      },
      document: {
        Math: {
          Fractions: {
            "Core concepts": ["Identify fractions", "Compare fractions"],
          },
        },
      },
      units: [
        {
          unitRef: "unit-fractions",
          title: "Fractions foundations",
          description: "Learn what fractions mean.",
          skillRefs: [
            "skill:math/fractions/core-concepts/identify-fractions",
            "skill:math/fractions/core-concepts/compare-fractions",
          ],
        },
      ],
    },
    currentRequest: "Rename the first unit to Fraction Basics",
    messages: [{ role: "user", content: "Rename the first unit to Fraction Basics" }],
  });

  assert.equal(parsed.learnerName, "Maya");
  assert.equal(parsed.currentCurriculum?.units.length, 1);
});
