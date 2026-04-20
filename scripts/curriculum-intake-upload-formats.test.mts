import assert from "node:assert/strict";
import test from "node:test";

import { normalizeImageForVisionModel } from "../lib/homeschool/intake/model-input.ts";
import {
  COMMON_SOURCE_UPLOAD_ACCEPT,
  resolveUploadModality,
  supportsOpenAiVisionImageInput,
} from "../lib/homeschool/intake/upload-formats.ts";

test("COMMON_SOURCE_UPLOAD_ACCEPT includes common image and document formats", () => {
  assert.match(COMMON_SOURCE_UPLOAD_ACCEPT, /\.svg/);
  assert.match(COMMON_SOURCE_UPLOAD_ACCEPT, /\.docx/);
  assert.match(COMMON_SOURCE_UPLOAD_ACCEPT, /\.pptx/);
  assert.match(COMMON_SOURCE_UPLOAD_ACCEPT, /\.xlsx/);
  assert.match(COMMON_SOURCE_UPLOAD_ACCEPT, /\.xml/);
  assert.match(COMMON_SOURCE_UPLOAD_ACCEPT, /image\/\*/);
});

test("resolveUploadModality classifies camera, image, pdf, and generic file uploads", () => {
  assert.equal(
    resolveUploadModality({ name: "camera-capture.heic", type: "image/heic" }, "camera"),
    "photo",
  );
  assert.equal(
    resolveUploadModality({ name: "equivalent-fractions.svg", type: "image/svg+xml" }),
    "image",
  );
  assert.equal(resolveUploadModality({ name: "lesson-plan.pdf", type: "application/pdf" }), "pdf");
  assert.equal(
    resolveUploadModality({
      name: "scope-and-sequence.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "file",
  );
});

test("supportsOpenAiVisionImageInput only marks directly supported vision image formats", () => {
  assert.equal(
    supportsOpenAiVisionImageInput({ name: "worksheet.png", type: "image/png" }),
    true,
  );
  assert.equal(
    supportsOpenAiVisionImageInput({ name: "worksheet.svg", type: "image/svg+xml" }),
    false,
  );
  assert.equal(
    supportsOpenAiVisionImageInput({ name: "worksheet.heic", type: "image/heic" }),
    false,
  );
});

test("normalizeImageForVisionModel rasterizes unsupported image formats to png", async () => {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60">
      <rect width="120" height="60" fill="#fff7ed"/>
      <text x="8" y="34" font-size="18">Fractions</text>
    </svg>`,
    "utf8",
  );

  const normalized = await normalizeImageForVisionModel({
    bytes: svg,
    fileName: "equivalent-fractions.svg",
    mimeType: "image/svg+xml",
  });

  assert.equal(normalized.normalized, true);
  assert.equal(normalized.mimeType, "image/png");
  assert.equal(normalized.fileName, "equivalent-fractions.png");
  assert.deepEqual([...normalized.bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
