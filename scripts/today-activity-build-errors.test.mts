import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { summarizeActivityBuildError } from "../lib/planning/activity-build-errors.ts";

test("summarizeActivityBuildError rewrites media URL validation failures into user-facing guidance", () => {
  const summary = summarizeActivityBuildError(
    new Error('[{ "validation": "url", "code": "invalid_string", "message": "Invalid url", "path": [ "artifact", "components", 2, "src" ] }]'),
  );

  assert.equal(summary.kind, "artifact_media");
  assert.match(summary.userMessage, /generated image or media item was invalid/i);
  assert.match(summary.userMessage, /lesson draft is still ready to teach from/i);
});

test("summarizeActivityBuildError keeps media validation failures specific even when they come from ActivitySpec validation", () => {
  const summary = summarizeActivityBuildError(
    new Error(
      "learning-core returned an invalid ActivitySpec: error: components.0.imageUrl: Invalid url",
    ),
  );

  assert.equal(summary.kind, "artifact_media");
  assert.match(summary.userMessage, /generated image or media item was invalid/i);
});

test("summarizeActivityBuildError handles transport failures separately", () => {
  const summary = summarizeActivityBuildError(new Error("fetch failed: ECONNREFUSED"));

  assert.equal(summary.kind, "transport");
  assert.match(summary.userMessage, /couldn't reach the activity generation service/i);
});

test("summarizeActivityBuildError formats zod errors before classifying them", () => {
  const zodError = new z.ZodError([
    {
      code: z.ZodIssueCode.invalid_string,
      validation: "url",
      message: "Invalid url",
      path: ["artifact", "components", 2, "src"],
    },
  ]);

  const summary = summarizeActivityBuildError(zodError);

  assert.equal(summary.kind, "artifact_media");
  assert.match(summary.rawMessage, /artifact\.components\.2\.src: Invalid url/);
});
