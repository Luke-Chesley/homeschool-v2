import test from "node:test";
import assert from "node:assert/strict";

import {
  truncateCurriculumFailureReason,
} from "@/lib/curriculum/ai-draft-service";

test("truncateCurriculumFailureReason bounds long reasons", () => {
  const reason = truncateCurriculumFailureReason("x".repeat(200));

  assert.equal(reason.length, 120);
  assert.ok(reason.endsWith("..."));
});
