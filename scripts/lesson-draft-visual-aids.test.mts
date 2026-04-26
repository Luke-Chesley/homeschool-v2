import assert from "node:assert/strict";
import test from "node:test";

import { computeLessonDraftFingerprint } from "@/lib/lesson-draft/fingerprint";
import { StructuredLessonDraftSchema } from "@/lib/lesson-draft/validate";

const allowedCloudUrl =
  "https://upload.wikimedia.org/wikipedia/commons/b/b5/Cumulus_clouds_in_fair_weather.jpeg";

function buildDraft(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "1.0",
    title: "Cloud Observation",
    lesson_focus: "Use a cloud photo to identify observable cloud features.",
    primary_objectives: ["Describe cloud shape and weather clues."],
    success_criteria: ["Learner names one visible cloud feature."],
    total_minutes: 20,
    visual_aids: [
      {
        id: "cloud-photo",
        title: "Cumulus cloud reference",
        kind: "reference_image",
        url: allowedCloudUrl,
        alt: "White cumulus clouds against a blue sky.",
        caption: "A fair-weather cumulus cloud reference photo.",
        usage_note: "Ask what shape and height clues the learner notices.",
        source_name: "Wikimedia Commons",
      },
    ],
    blocks: [
      {
        type: "demonstration",
        title: "Look at the cloud",
        minutes: 10,
        purpose: "Introduce visual cloud observation.",
        teacher_action: "Show the photo and name one visible feature.",
        learner_action: "Point to one feature and describe it.",
        check_for: "Learner names a visible cloud feature.",
        visual_aid_ids: ["cloud-photo"],
      },
      {
        type: "check_for_understanding",
        title: "Quick check",
        minutes: 10,
        purpose: "Confirm the learner can use visual evidence.",
        teacher_action: "Ask what weather clue the cloud gives.",
        learner_action: "Answer with one visible clue.",
        check_for: "Learner uses the photo as evidence.",
      },
    ],
    materials: ["cloud photo"],
    teacher_notes: ["Keep the observation concrete."],
    adaptations: [],
    ...overrides,
  };
}

test("StructuredLessonDraftSchema accepts allowed visual aid URLs and block references", () => {
  const parsed = StructuredLessonDraftSchema.parse(buildDraft());

  assert.equal(parsed.visual_aids?.[0]?.url, allowedCloudUrl);
  assert.deepEqual(parsed.blocks[0]?.visual_aid_ids, ["cloud-photo"]);
});

test("StructuredLessonDraftSchema rejects visual aid URLs outside the allowlist", () => {
  assert.throws(
    () =>
      StructuredLessonDraftSchema.parse(
        buildDraft({
          visual_aids: [
            {
              id: "bad-photo",
              title: "Random photo",
              kind: "reference_image",
              url: "https://example.com/cloud.jpg",
              alt: "Random cloud photo.",
            },
          ],
          blocks: [
            {
              ...buildDraft().blocks[0],
              visual_aid_ids: ["bad-photo"],
            },
            buildDraft().blocks[1],
          ],
        }),
      ),
    /Visual aid URL host is not allowed/,
  );
});

test("StructuredLessonDraftSchema rejects unknown visual aid references", () => {
  assert.throws(
    () =>
      StructuredLessonDraftSchema.parse(
        buildDraft({
          blocks: [
            {
              ...buildDraft().blocks[0],
              visual_aid_ids: ["missing-photo"],
            },
            buildDraft().blocks[1],
          ],
        }),
      ),
    /Unknown visual aid id/,
  );
});

test("lesson draft fingerprint changes when visual aids change", () => {
  const first = StructuredLessonDraftSchema.parse(buildDraft());
  const second = StructuredLessonDraftSchema.parse(
    buildDraft({
      visual_aids: [
        {
          ...buildDraft().visual_aids[0],
          caption: "A revised caption.",
        },
      ],
    }),
  );

  assert.notEqual(computeLessonDraftFingerprint(first), computeLessonDraftFingerprint(second));
});
