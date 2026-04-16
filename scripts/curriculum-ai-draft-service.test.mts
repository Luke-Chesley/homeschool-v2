import test from "node:test";
import assert from "node:assert/strict";

import { generateCurriculumArtifact, truncateCurriculumFailureReason } from "@/lib/curriculum/ai-draft-service";

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
