import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SourceInterpretArtifactSchema,
  SourceInterpretInputSchema,
} from "../lib/learning-core/source-interpret.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function walkSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ts|tsx|mts)$/.test(entry.name)) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

test("legacy app-owned AI modules are deleted", () => {
  const deletedPaths = [
    "app/api/ai/generate/route.ts",
    "app/api/ai/jobs/[jobId]/route.ts",
    "components/copilot/GenerateButton.tsx",
    "lib/ai/learning-core-adapter.ts",
    "lib/ai/provider-adapter.ts",
    "lib/ai/task-service.ts",
    "lib/db/repositories/ai-platform.ts",
    "lib/db/schema/aiPlatform.ts",
    "lib/prompts/store.ts",
    "lib/prompts/curriculum-draft.ts",
    "lib/prompts/lesson-draft.ts",
  ];

  for (const relativePath of deletedPaths) {
    assert.equal(
      existsSync(path.join(repoRoot, relativePath)),
      false,
      `${relativePath} should be deleted after the learning-core cutover.`,
    );
  }
});

test("active app code does not reference deleted prompt or gateway paths", () => {
  const sourceRoots = ["app", "components", "lib"].map((segment) => path.join(repoRoot, segment));
  const files = sourceRoots.flatMap((root) => (existsSync(root) ? walkSourceFiles(root) : []));

  const forbiddenPatterns = [
    { label: "legacy prompt resolver", regex: /resolvePrompt\(/ },
    { label: "legacy gateway path", regex: /\/v1\/gateway\// },
    { label: "deleted prompt module", regex: /lib\/prompts\// },
    { label: "deleted task service", regex: /task-service/ },
    { label: "deleted learning-core adapter", regex: /learning-core-adapter/ },
    { label: "deleted provider adapter", regex: /provider-adapter/ },
    { label: "deleted generate endpoint", regex: /\/api\/ai\/generate\b/ },
    { label: "legacy source_interpret source kind", regex: /\bsingle_day_material\b/ },
    { label: "legacy source_interpret source kind", regex: /\bweekly_assignments\b/ },
    { label: "legacy source_interpret source kind", regex: /\bsequence_outline\b/ },
    { label: "legacy source_interpret horizon intent", regex: /\buserHorizonIntent\b/ },
    { label: "legacy source_interpret metadata", regex: /\bsourceScale\b/ },
    { label: "legacy source_interpret metadata", regex: /\bsliceStrategy\b/ },
    { label: "legacy source_interpret metadata", regex: /\bsliceNotes\b/ },
  ];

  const violations: string[] = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    const relativePath = path.relative(repoRoot, filePath);
    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(source)) {
        violations.push(`${relativePath}: ${pattern.label}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Active source still references deleted AI paths:\n${violations.join("\n")}`,
  );
});

test("learning-core client surface is operation-based", () => {
  const operationsSource = readFileSync(
    path.join(repoRoot, "lib/learning-core/operations.ts"),
    "utf8",
  );
  const clientSource = readFileSync(
    path.join(repoRoot, "lib/learning-core/client.ts"),
    "utf8",
  );

  assert.match(operationsSource, /\/v1\/operations\/\$\{operationName\}\/prompt-preview/);
  assert.match(operationsSource, /\/v1\/operations\/\$\{operationName\}\/execute/);
  assert.doesNotMatch(clientSource, /\/v1\/gateway\//);
});

test("source interpret wrapper matches the canonical request shape", () => {
  const parsed = SourceInterpretInputSchema.parse({
    learnerName: "Ava",
    requestedRoute: "outline",
    extractedText: "Workbook chapter 1",
    sourcePackages: [
      {
        id: "pkg-1",
        title: "Workbook",
        modality: "pdf",
        summary: "Fractions workbook",
        extractionStatus: "ready",
        assetCount: 1,
        assetIds: ["asset-1"],
        detectedChunks: ["Chapter 1"],
        sourceFingerprint: "fp-1",
      },
    ],
    sourceFiles: [
      {
        assetId: "asset-1",
        packageId: "pkg-1",
        title: "Workbook",
        modality: "pdf",
        fileName: "workbook.pdf",
        mimeType: "application/pdf",
        fileUrl: "https://example.com/workbook.pdf",
      },
    ],
  });

  assert.deepEqual(parsed.inputModalities, []);
  assert.equal(parsed.sourcePackages[0]?.id, "pkg-1");
  assert.equal(parsed.sourceFiles[0]?.assetId, "asset-1");

  assert.throws(
    () =>
      SourceInterpretInputSchema.parse({
        requestedRoute: "topic",
        extractedText: "Teach chess openings",
        userHorizonIntent: "starter_module",
      }),
    /unrecognized key/i,
  );
});

test("source interpret wrapper rejects legacy source kinds and keeps canonical taxonomy", () => {
  const parsed = SourceInterpretArtifactSchema.parse({
    sourceKind: "comprehensive_source",
    entryStrategy: "explicit_range",
    entryLabel: "chapter 1",
    continuationMode: "sequential",
    suggestedTitle: "Fractions workbook",
    confidence: "medium",
    recommendedHorizon: "one_week",
    assumptions: ["Start with chapter 1 and keep the rest available for continuation."],
    detectedChunks: ["Chapter 1", "Chapter 2"],
    needsConfirmation: false,
  });

  assert.deepEqual(parsed.assumptions, [
    "Start with chapter 1 and keep the rest available for continuation.",
  ]);
  assert.deepEqual(parsed.detectedChunks, ["Chapter 1", "Chapter 2"]);
  assert.equal(parsed.needsConfirmation, false);

  assert.throws(
    () =>
      SourceInterpretArtifactSchema.parse({
        ...parsed,
        sourceKind: "full_curriculum",
      }),
    /invalid enum value/i,
  );
});
