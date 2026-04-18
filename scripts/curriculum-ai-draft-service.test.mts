import test from "node:test";
import assert from "node:assert/strict";

import {
  createCurriculumFromConversation,
  generateCurriculumArtifact,
  truncateCurriculumFailureReason,
} from "@/lib/curriculum/ai-draft-service";

function buildArtifact() {
  return {
    source: {
      title: "Starter Curriculum",
      description: "A small generated curriculum.",
      subjects: ["History"],
      gradeLevels: ["5th"],
      summary: "A short history sequence.",
      teachingApproach: "Narration and notebooking.",
      successSignals: ["Learner can narrate major events."],
      parentNotes: ["Keep a timeline notebook."],
      rationale: ["Start with vivid stories and recurring review."],
    },
    intakeSummary: "A short history sequence grounded in the chat.",
    pacing: {
      totalWeeks: 2,
      sessionsPerWeek: 4,
      sessionMinutes: 35,
      totalSessions: 8,
      coverageStrategy: "Build background knowledge and reinforce it with review.",
      coverageNotes: ["Keep lessons short and cumulative."],
    },
    document: {
      History: {
        Foundations: {
          "Key Events": ["Event 1", "Event 2"],
        },
      },
    },
    units: [
      {
        title: "Unit 1",
        description: "Start with the main events.",
        estimatedWeeks: 2,
        estimatedSessions: 8,
        lessons: [
          {
            title: "Lesson 1",
            description: "Introduce the first events.",
            estimatedMinutes: 35,
            materials: ["Notebook"],
            objectives: ["Narrate the first event."],
            linkedSkillTitles: ["Event 1"],
          },
        ],
      },
    ],
    launchPlan: {
      recommendedHorizon: "one_week",
      openingLessonCount: 4,
      scopeSummary: "Open with the first week of lessons.",
      initialSliceUsed: true,
      initialSliceLabel: "Unit 1",
      entryStrategy: "use_as_is",
      entryLabel: "Unit 1",
      continuationMode: "sequential",
    },
  };
}

test("truncateCurriculumFailureReason bounds long reasons", () => {
  const reason = truncateCurriculumFailureReason("x".repeat(200));

  assert.equal(reason.length, 120);
  assert.ok(reason.endsWith("..."));
});

test("generateCurriculumArtifact returns a failure result when the execute step throws a long error", async () => {
  const result = await generateCurriculumArtifact(
    {
      learner: {
        id: "learner_123",
        organizationId: "org_123",
        displayName: "ed",
        firstName: "ed",
        lastName: null,
        status: "active",
      },
      messages: [{ role: "user", content: "Build a curriculum." }],
    },
    {
      execute: async () => {
        throw new Error("Array must contain at most 6 element(s) at artifact.source.successSignals. ".repeat(4));
      },
    },
  );

  assert.equal(result.kind, "failure");
  assert.equal(result.stage, "generation");
  assert.equal(result.userSafeMessage, "Could not generate this curriculum yet.");
  assert.ok(result.reason.length <= 120);
  assert.equal(result.debugMetadata?.originalReason !== undefined, true);
});

test("generateCurriculumArtifact sends a conversation_intake request to learning-core", async () => {
  let captured:
    | Parameters<NonNullable<Parameters<typeof generateCurriculumArtifact>[1]>["execute"]>[0]
    | undefined;

  const result = await generateCurriculumArtifact(
    {
      learner: {
        id: "learner_123",
        organizationId: "org_123",
        displayName: "ed",
        firstName: "ed",
        lastName: null,
        status: "active",
      },
      messages: [{ role: "user", content: "Build a curriculum." }],
      sourcePackages: [
        {
          id: "pkg_1",
          title: "Reader",
          modality: "pdf",
          summary: "A PDF reader.",
          extractionStatus: "ready",
          assetCount: 1,
          assetIds: ["asset_1"],
          detectedChunks: [],
          sourceFingerprint: "fp_1",
        },
      ],
      sourceFiles: [
        {
          assetId: "asset_1",
          packageId: "pkg_1",
          title: "Reader",
          modality: "pdf",
          fileName: "reader.pdf",
          mimeType: "application/pdf",
          fileData: "data:application/pdf;base64,ZmFrZQ==",
        },
      ],
    },
    {
      execute: async (params) => {
        captured = params;
        return { artifact: buildArtifact() } as Awaited<
          ReturnType<NonNullable<Parameters<typeof generateCurriculumArtifact>[1]>["execute"]>
        >;
      },
    },
  );

  assert.equal(result.kind, "success");
  assert.deepEqual(captured?.input, {
    learnerName: "ed",
    requestMode: "conversation_intake",
    messages: [{ role: "user", content: "Build a curriculum." }],
    granularityGuidance: [],
    correctionNotes: [],
  });
});

test("createCurriculumFromConversation persists artifacts with conversation_intake mode", async () => {
  let captured:
    | Parameters<NonNullable<Parameters<typeof createCurriculumFromConversation>[1]>["persist"]>[0]
    | undefined;

  const created = await createCurriculumFromConversation(
    {
      householdId: "org_123",
      learner: {
        id: "learner_123",
        organizationId: "org_123",
        displayName: "ed",
        firstName: "ed",
        lastName: null,
        status: "active",
      },
      messages: [{ role: "user", content: "Build a curriculum." }],
    },
    {
      generate: async () => ({
        kind: "success",
        artifact: buildArtifact(),
      }),
      persist: async (params) => {
        captured = params;
        return {
          sourceId: "source_123",
          sourceTitle: "Starter Curriculum",
          nodeCount: 5,
          skillCount: 2,
          unitCount: 1,
          lessonCount: 1,
          estimatedSessionCount: 8,
        };
      },
    },
  );

  assert.equal(created.kind, "success");
  assert.equal(captured?.requestMode, "conversation_intake");
  assert.equal(captured?.artifact.source.title, "Starter Curriculum");
});
