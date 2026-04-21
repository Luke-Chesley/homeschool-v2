import assert from "node:assert/strict";
import test from "node:test";

import type { ActivitySpec } from "../lib/activities/spec.ts";
import {
  coerceActivityAttachmentEntries,
  collectUploadedActivityAssets,
  sanitizeActivityUploadFileName,
} from "../lib/activities/uploads.ts";

test("sanitizeActivityUploadFileName normalizes learner activity uploads", () => {
  assert.equal(
    sanitizeActivityUploadFileName("  Bridge Photo (Final).JPG  "),
    "bridge-photo-final-.jpg",
  );
  assert.equal(sanitizeActivityUploadFileName(""), "activity-upload");
});

test("coerceActivityAttachmentEntries preserves stored attachments and upgrades legacy names", () => {
  const stored = coerceActivityAttachmentEntries(
    {
      files: [
        {
          id: "asset-1",
          name: "bridge-plan.pdf",
          kind: "file",
          storageBucket: "learner-uploads",
          storagePath: "org/learner/activity-evidence/session/attempt/component/asset-1-bridge-plan.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          uploadedAt: "2026-04-20T12:00:00.000Z",
        },
      ],
    },
    "files",
    "file",
  );

  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.storagePath, "org/learner/activity-evidence/session/attempt/component/asset-1-bridge-plan.pdf");
  assert.equal(stored[0]?.kind, "file");

  const legacy = coerceActivityAttachmentEntries(
    {
      fileNames: ["photo-1.jpg", "photo-2.jpg"],
    },
    "images",
    "image",
  );

  assert.deepEqual(
    legacy.map((entry) => ({ name: entry.name, kind: entry.kind })),
    [
      { name: "photo-1.jpg", kind: "image" },
      { name: "photo-2.jpg", kind: "image" },
    ],
  );
});

test("collectUploadedActivityAssets returns only stored learner activity attachments", () => {
  const spec: ActivitySpec = {
    schemaVersion: "2",
    title: "Build a bridge",
    purpose: "Document the plan and photo evidence from the bridge build.",
    activityKind: "offline_real_world",
    linkedObjectiveIds: [],
    linkedSkillLabels: ["bridge testing"],
    estimatedMinutes: 20,
    interactionMode: "offline",
    components: [
      {
        type: "file_upload",
        id: "bridge-plan",
        prompt: "Upload your bridge sketch.",
        notePrompt: "What changed after testing?",
        required: false,
      },
      {
        type: "image_capture",
        id: "bridge-photo",
        prompt: "Take a photo of the finished bridge.",
        required: false,
      },
      {
        type: "paragraph",
        id: "intro",
        text: "Use the upload blocks below to document your build.",
      },
    ],
    completionRules: { strategy: "any_submission" },
    evidenceSchema: {
      captureKinds: ["file_artifact", "image_artifact"],
      requiresReview: true,
      autoScorable: false,
    },
    scoringModel: {
      mode: "teacher_observed",
      masteryThreshold: 0.8,
      reviewThreshold: 0.6,
    },
    offlineMode: {
      offlineTaskDescription: "Build a bridge, test it, and upload your evidence.",
    },
  };

  const collected = collectUploadedActivityAssets({
    spec,
    evidence: {
      "bridge-plan": {
        files: [
          {
            id: "asset-file",
            name: "bridge-plan.pdf",
            kind: "file",
            storageBucket: "learner-uploads",
            storagePath: "org/learner/activity-evidence/session/attempt/bridge-plan/asset-file-bridge-plan.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            uploadedAt: "2026-04-20T12:00:00.000Z",
          },
          {
            id: "legacy-name-only",
            name: "local-only.txt",
          },
        ],
        note: "We added more tape after the first test.",
      },
      "bridge-photo": {
        images: [
          {
            id: "asset-image",
            name: "bridge.jpg",
            kind: "image",
            storageBucket: "learner-uploads",
            storagePath: "org/learner/activity-evidence/session/attempt/bridge-photo/asset-image-bridge.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 4096,
            uploadedAt: "2026-04-20T12:05:00.000Z",
          },
        ],
      },
    },
  });

  assert.equal(collected.length, 2);
  assert.deepEqual(
    collected.map((entry) => ({
      componentId: entry.componentId,
      componentType: entry.componentType,
      prompt: entry.prompt,
      note: entry.note,
      storagePath: entry.asset.storagePath,
    })),
    [
      {
        componentId: "bridge-plan",
        componentType: "file_upload",
        prompt: "Upload your bridge sketch.",
        note: "We added more tape after the first test.",
        storagePath: "org/learner/activity-evidence/session/attempt/bridge-plan/asset-file-bridge-plan.pdf",
      },
      {
        componentId: "bridge-photo",
        componentType: "image_capture",
        prompt: "Take a photo of the finished bridge.",
        note: null,
        storagePath: "org/learner/activity-evidence/session/attempt/bridge-photo/asset-image-bridge.jpg",
      },
    ],
  );
});
