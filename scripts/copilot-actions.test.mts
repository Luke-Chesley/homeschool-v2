import assert from "node:assert/strict";
import test from "node:test";

import {
  CopilotActionSchema,
  CopilotChatArtifactSchema,
  CopilotStreamEventSchema,
} from "../lib/ai/types.ts";
import { getRenderableCopilotContent } from "../lib/ai/copilot-message-content.ts";

test("copilot chat artifact accepts the bounded action registry", () => {
  const artifact = CopilotChatArtifactSchema.parse({
    answer: "Friday is lighter. Move the fractions lesson there.",
    actions: [
      {
        id: "draft-1",
        kind: "planning.adjust_day_load",
        label: "Move fractions to Friday",
        description: "Shift one weekly route item onto the lighter Friday schedule.",
        rationale: "Friday has more open minutes in the current week.",
        confidence: "high",
        requiresApproval: true,
        target: {
          entityType: "weekly_route_item",
          entityId: "route-item-1",
          date: "2026-04-24",
        },
        payload: {
          weeklyRouteId: "weekly-route-1",
          weeklyRouteItemId: "route-item-1",
          currentDate: "2026-04-23",
          targetDate: "2026-04-24",
          targetIndex: 0,
          reason: "Friday has more space for this lesson.",
        },
      },
      {
        id: "draft-2",
        kind: "tracking.record_note",
        label: "Save the pacing note",
        description: "Capture the parent observation in tracking.",
        requiresApproval: true,
        payload: {
          body: "Math pacing slowed once the worksheet moved into word problems.",
          noteType: "adaptation_signal",
          lessonSessionId: "lesson-session-1",
        },
      },
    ],
  });

  assert.equal(artifact.actions[0]?.kind, "planning.adjust_day_load");
  assert.equal(artifact.actions[1]?.kind, "tracking.record_note");
});

test("persisted copilot action schema rejects unsupported kinds", () => {
  assert.throws(
    () =>
      CopilotActionSchema.parse({
        id: "action-1",
        kind: "standards.map",
        label: "Map standards",
        description: "Unsupported action kind.",
        requiresApproval: true,
        payload: {},
        status: "pending",
        createdAt: new Date().toISOString(),
      }),
    /Invalid discriminator value/i,
  );
});

test("copilot stream events require persisted action lifecycle fields", () => {
  const parsed = CopilotStreamEventSchema.parse({
    type: "actions",
    actions: [
      {
        id: "action-1",
        kind: "planning.generate_today_lesson",
        label: "Generate today's lesson",
        description: "Build the lesson draft for today.",
        requiresApproval: true,
        payload: {
          date: "2026-04-20",
          reason: "The parent asked for the next lesson draft.",
        },
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(parsed.type, "actions");
  assert.equal(parsed.actions[0]?.status, "pending");
});

test("copilot message content unwraps serialized artifact json", () => {
  const rendered = getRenderableCopilotContent(
    JSON.stringify({
      answer: "I can help with:\n\n- Move one item\n- Draft today's lesson",
      actions: [],
    }),
  );

  assert.equal(rendered, "I can help with:\n\n- Move one item\n- Draft today's lesson");
});

test("copilot message content drops trailing serialized artifact duplication", () => {
  const rendered = getRenderableCopilotContent(`I can help with a few things:

- Move one item
- Draft today's lesson

{"answer":"Use the markdown copy only.","actions":[]}`);

  assert.equal(
    rendered,
    "I can help with a few things:\n\n- Move one item\n- Draft today's lesson",
  );
});

test("copilot message content hides an incomplete trailing serialized artifact while streaming", () => {
  const rendered = getRenderableCopilotContent(`I can help with a few things:

- Move one item

{"answer":"I can help`);

  assert.equal(rendered, "I can help with a few things:\n\n- Move one item");
});
