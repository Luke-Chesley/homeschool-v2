import assert from "node:assert/strict";
import test from "node:test";

import { StructuredLessonDraftSchema } from "../lib/lesson-draft/validate.ts";
import { buildLearningCoreExecuteResponseSchema } from "../lib/learning-core/operations.ts";

const validArtifact = {
  schema_version: "1.0",
  title: "Chess Check Basics",
  lesson_focus: "Practice answering check and responding to 1. e4.",
  primary_objectives: [
    "Respond correctly to 1. e4",
    "Recognize check",
  ],
  success_criteria: [
    "Learner gives one legal reply to 1. e4",
    "Learner names one legal escape from check",
  ],
  total_minutes: 20,
  blocks: [
    {
      type: "demonstration",
      title: "Show the rule",
      minutes: 10,
      purpose: "Introduce the pattern",
      teacher_action: "Set up one board position and model the response.",
      learner_action: "Watch, then name the move.",
      check_for: "Learner names the move and the threat.",
      materials_needed: ["Chessboard"],
      optional: false,
    },
    {
      type: "check_for_understanding",
      title: "Quick check",
      minutes: 10,
      purpose: "Verify the learner can apply the rule",
      teacher_action: "Show one more position and ask for a legal response.",
      learner_action: "Choose the move and explain why.",
      check_for: "Learner picks a legal response.",
      materials_needed: ["Chessboard"],
      optional: false,
    },
  ],
  materials: ["Chessboard"],
  teacher_notes: ["Keep prompts short."],
  adaptations: [{ trigger: "if_struggles", action: "Reduce to one example." }],
};

test("StructuredLessonDraftSchema accepts canonical lesson_shape slugs from learning-core", () => {
  const schema = buildLearningCoreExecuteResponseSchema(StructuredLessonDraftSchema);
  const result = schema.safeParse({
    operation_name: "session_generate",
    artifact: {
      ...validArtifact,
      lesson_shape: "direct_instruction",
    },
    lineage: {
      operation_name: "session_generate",
      skill_name: "session_generate",
      skill_version: "2026-04-09",
      provider: "openai",
      model: "gpt-5.4-mini",
      executed_at: "2026-04-09T19:56:57.710414Z",
    },
    trace: {
      request_id: "req_123",
      operation_name: "session_generate",
      allowed_tools: [],
      prompt_preview: {
        system_prompt: "system",
        user_prompt: "user",
      },
      request_envelope: {
        input: {},
        app_context: {},
        presentation_context: {},
        user_authored_context: {},
        request_id: "req_123",
      },
      executed_at: "2026-04-09T19:56:57.710414Z",
    },
  });

  assert.equal(result.success, true);
});

test("StructuredLessonDraftSchema rejects prose lesson_shape labels at the execute-response boundary", () => {
  const schema = buildLearningCoreExecuteResponseSchema(StructuredLessonDraftSchema);
  const result = schema.safeParse({
    operation_name: "session_generate",
    artifact: {
      ...validArtifact,
      lesson_shape: "Short teach-practice-check sequence",
    },
    lineage: {
      operation_name: "session_generate",
      skill_name: "session_generate",
      skill_version: "2026-04-09",
      provider: "openai",
      model: "gpt-5.4-mini",
      executed_at: "2026-04-09T19:56:57.710414Z",
    },
    trace: {
      request_id: "req_123",
      operation_name: "session_generate",
      allowed_tools: [],
      prompt_preview: {
        system_prompt: "system",
        user_prompt: "user",
      },
      request_envelope: {
        input: {},
        app_context: {},
        presentation_context: {},
        user_authored_context: {},
        request_id: "req_123",
      },
      executed_at: "2026-04-09T19:56:57.710414Z",
    },
  });

  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some((issue) => issue.path.join(".") === "artifact.lesson_shape"),
  );
});
