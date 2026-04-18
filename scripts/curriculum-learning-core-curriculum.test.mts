import test from "node:test";
import assert from "node:assert/strict";

import {
  CurriculumGenerateInputSchema,
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

test("CurriculumGenerateSourceEntryInputSchema requires non-empty sourceText", () => {
  const parsed = CurriculumGenerateSourceEntryInputSchema.safeParse({
    learnerName: "Maya",
    requestMode: "source_entry",
    requestedRoute: "outline",
    routedRoute: "outline",
    sourceKind: "structured_sequence",
    entryStrategy: "use_as_is",
    continuationMode: "sequential",
    recommendedHorizon: "one_week",
    sourceText: "   ",
    sourcePackages: [],
    sourceFiles: [],
    detectedChunks: [],
    assumptions: [],
  });

  assert.equal(parsed.success, false);
});
