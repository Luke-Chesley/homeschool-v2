import assert from "node:assert/strict";
import test from "node:test";

import { executeSourceInterpret } from "../lib/learning-core/source-interpret.ts";

const ORIGINAL_FETCH = globalThis.fetch;
const TEST_TIMESTAMP = "2026-04-18T12:00:00.000Z";

function buildSourcePackage(overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg-1",
    title: "Source package",
    modality: "pdf",
    summary: "Uploaded source package",
    extractionStatus: "ready",
    assetCount: 1,
    assetIds: ["asset-1"],
    detectedChunks: ["Chapter 1"],
    sourceFingerprint: "fp-1",
    ...overrides,
  };
}

function buildSourceFile(overrides: Record<string, unknown> = {}) {
  return {
    assetId: "asset-1",
    packageId: "pkg-1",
    title: "Source package",
    modality: "pdf",
    fileName: "source.pdf",
    mimeType: "application/pdf",
    fileUrl: "https://example.com/source.pdf",
    ...overrides,
  };
}

function buildArtifact(overrides: Record<string, unknown> = {}) {
  return {
    sourceKind: "bounded_material",
    entryStrategy: "use_as_is",
    entryLabel: null,
    continuationMode: "none",
    deliveryPattern: "skill_first",
    suggestedTitle: "Fractions practice",
    confidence: "high",
    recommendedHorizon: "single_day",
    assumptions: [],
    detectedChunks: ["Fractions practice"],
    followUpQuestion: null,
    needsConfirmation: false,
    ...overrides,
  };
}

function buildExecutePayload(
  artifact: Record<string, unknown>,
  requestEnvelopeInput: Record<string, unknown>,
) {
  return {
    operation_name: "source_interpret",
    artifact,
    lineage: {
      operation_name: "source_interpret",
      skill_name: "source_interpret",
      skill_version: "test",
      provider: "test",
      model: "test-model",
      executed_at: TEST_TIMESTAMP,
    },
    trace: {
      request_id: "req-source-interpret",
      operation_name: "source_interpret",
      allowed_tools: [],
      prompt_preview: {
        system_prompt: "Use the new source_interpret taxonomy only.",
        user_prompt: "Prompt preview for source_interpret.",
      },
      request_envelope: {
        input: requestEnvelopeInput,
        app_context: {
          product: "homeschool-v2",
          surface: "onboarding",
        },
        presentation_context: {
          audience: "internal",
          tone: "practical",
          ui_density: "normal",
          display_intent: "review",
          should_return_prompt_preview: false,
        },
        user_authored_context: {
          note: null,
          teacher_note: null,
          parent_goal: null,
          special_constraints: [],
          custom_instruction: null,
          avoidances: [],
        },
        request_id: null,
      },
      executed_at: TEST_TIMESTAMP,
    },
    prompt_preview: {
      system_prompt: "Use the new source_interpret taxonomy only.",
      user_prompt: "Prompt preview for source_interpret.",
    },
  };
}

async function executeWithMockedSourceInterpret(params: {
  input: {
    learnerName?: string | null;
    requestedRoute: "single_lesson" | "weekly_plan" | "outline" | "topic" | "manual_shell";
    inputModalities: Array<"text" | "outline" | "photo" | "image" | "pdf" | "file">;
    rawText?: string | null;
    extractedText: string;
    extractedStructure?: Record<string, unknown> | null;
    assetRefs?: string[];
    sourcePackages?: Array<Record<string, unknown>>;
    sourceFiles?: Array<Record<string, unknown>>;
    titleCandidate?: string | null;
  };
  artifact: Record<string, unknown>;
}) {
  process.env.LEARNING_CORE_BASE_URL = "http://learning-core.test";
  process.env.LEARNING_CORE_API_KEY = "test-key";

  const requests: Array<{ url: string; init: RequestInit | undefined; body: Record<string, unknown> }> =
    [];

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ url, init, body });

    return new Response(JSON.stringify(buildExecutePayload(params.artifact, body.input ?? {})), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const result = await executeSourceInterpret({
    input: params.input,
    surface: "onboarding",
    organizationId: "org-1",
    learnerId: "learner-1",
    workflowMode: "fast_path",
  });

  assert.equal(requests.length, 1);
  return { result, request: requests[0]! };
}

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

test("executeSourceInterpret sends sourcePackages/sourceFiles and parses a worksheet result", async () => {
  const sourcePackages = [
    buildSourcePackage({
      title: "Worksheet photo",
      modality: "photo",
      summary: "One worksheet page",
      detectedChunks: ["Fractions review"],
    }),
  ];
  const sourceFiles = [
    buildSourceFile({
      title: "Worksheet photo",
      modality: "photo",
      fileName: "worksheet.jpg",
      mimeType: "image/jpeg",
      fileUrl: "https://example.com/worksheet.jpg",
    }),
  ];

  const { result, request } = await executeWithMockedSourceInterpret({
    input: {
      learnerName: "Ava",
      requestedRoute: "single_lesson",
      inputModalities: ["photo"],
      rawText: "Worksheet page about equivalent fractions.",
      extractedText: "Worksheet page about equivalent fractions.",
      extractedStructure: { detectedChunks: ["Fractions review"] },
      assetRefs: ["asset-1"],
      sourcePackages,
      sourceFiles,
      titleCandidate: "Equivalent fractions worksheet",
    },
    artifact: buildArtifact({
      sourceKind: "bounded_material",
      entryStrategy: "use_as_is",
      continuationMode: "none",
      recommendedHorizon: "single_day",
      suggestedTitle: "Equivalent fractions worksheet",
      detectedChunks: ["Fractions review"],
    }),
  });

  assert.equal(result.artifact.sourceKind, "bounded_material");
  assert.equal(result.artifact.recommendedHorizon, "single_day");
  assert.equal(result.artifact.deliveryPattern, "skill_first");
  assert.equal(request.url, "http://learning-core.test/v1/operations/source_interpret/execute");
  assert.equal(request.body.input.requestedRoute, "single_lesson");
  assert.deepEqual(request.body.input.sourcePackages, sourcePackages);
  assert.deepEqual(request.body.input.sourceFiles, sourceFiles);
  assert.equal("userHorizonIntent" in request.body.input, false);
});

test("executeSourceInterpret parses a weekly plan result", async () => {
  const { result } = await executeWithMockedSourceInterpret({
    input: {
      learnerName: "Ava",
      requestedRoute: "weekly_plan",
      inputModalities: ["pdf"],
      rawText: "Week 1 math plan with Monday through Friday assignments.",
      extractedText: "Week 1 math plan with Monday through Friday assignments.",
      extractedStructure: { detectedChunks: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
      assetRefs: ["asset-1"],
      sourcePackages: [buildSourcePackage({ title: "Weekly plan" })],
      sourceFiles: [buildSourceFile({ title: "Weekly plan" })],
      titleCandidate: "Week 1 math",
    },
    artifact: buildArtifact({
      sourceKind: "timeboxed_plan",
      entryStrategy: "timebox_start",
      entryLabel: "week 1",
      continuationMode: "timebox",
      deliveryPattern: "timeboxed",
      recommendedHorizon: "one_week",
      suggestedTitle: "Week 1 math",
      detectedChunks: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    }),
  });

  assert.equal(result.artifact.sourceKind, "timeboxed_plan");
  assert.equal(result.artifact.entryStrategy, "timebox_start");
  assert.equal(result.artifact.recommendedHorizon, "one_week");
  assert.equal(result.artifact.deliveryPattern, "timeboxed");
});

test("executeSourceInterpret parses an ordered outline result", async () => {
  const { result } = await executeWithMockedSourceInterpret({
    input: {
      learnerName: "Ava",
      requestedRoute: "outline",
      inputModalities: ["outline"],
      rawText: "1. Number sense\n2. Fractions\n3. Decimals",
      extractedText: "1. Number sense\n2. Fractions\n3. Decimals",
      extractedStructure: { headings: ["Number sense", "Fractions", "Decimals"] },
      assetRefs: [],
      sourcePackages: [],
      sourceFiles: [],
      titleCandidate: "Math outline",
    },
    artifact: buildArtifact({
      sourceKind: "structured_sequence",
      entryStrategy: "sequential_start",
      continuationMode: "sequential",
      deliveryPattern: "concept_first",
      recommendedHorizon: "few_days",
      suggestedTitle: "Math outline",
      detectedChunks: ["Number sense", "Fractions", "Decimals"],
    }),
  });

  assert.equal(result.artifact.sourceKind, "structured_sequence");
  assert.equal(result.artifact.entryStrategy, "sequential_start");
  assert.match(result.artifact.recommendedHorizon, /few_days|one_week/);
});

test("executeSourceInterpret parses a whole-book result with a bounded initial horizon", async () => {
  const { result } = await executeWithMockedSourceInterpret({
    input: {
      learnerName: "Ava",
      requestedRoute: "outline",
      inputModalities: ["pdf"],
      rawText: "Complete cookbook PDF with table of contents and twelve chapters.",
      extractedText: "Complete cookbook PDF with table of contents and twelve chapters.",
      extractedStructure: { detectedChunks: ["Chapter 1", "Chapter 2", "Chapter 3"] },
      assetRefs: ["asset-1"],
      sourcePackages: [buildSourcePackage({ title: "Cookbook PDF", detectedChunks: ["Chapter 1", "Chapter 2", "Chapter 3"] })],
      sourceFiles: [buildSourceFile({ title: "Cookbook PDF", fileName: "cookbook.pdf" })],
      titleCandidate: "Kids in the Kitchen",
    },
    artifact: buildArtifact({
      sourceKind: "comprehensive_source",
      entryStrategy: "section_start",
      entryLabel: "chapter 1",
      continuationMode: "sequential",
      deliveryPattern: "task_first",
      recommendedHorizon: "one_week",
      suggestedTitle: "Kids in the Kitchen",
      detectedChunks: ["Chapter 1", "Chapter 2", "Chapter 3"],
      assumptions: ["Launch from chapter 1 and keep the rest available for continuation."],
    }),
  });

  assert.equal(result.artifact.sourceKind, "comprehensive_source");
  assert.match(result.artifact.entryStrategy, /section_start|explicit_range|sequential_start/);
  assert.match(result.artifact.recommendedHorizon, /few_days|one_week|two_weeks/);
});

test("executeSourceInterpret parses a topic seed result", async () => {
  const { result } = await executeWithMockedSourceInterpret({
    input: {
      learnerName: "Ava",
      requestedRoute: "topic",
      inputModalities: ["text"],
      rawText: "Teach my son fractions this summer.",
      extractedText: "Teach my son fractions this summer.",
      extractedStructure: null,
      assetRefs: [],
      sourcePackages: [],
      sourceFiles: [],
      titleCandidate: "Fractions",
    },
    artifact: buildArtifact({
      sourceKind: "topic_seed",
      entryStrategy: "scaffold_only",
      continuationMode: "manual_review",
      deliveryPattern: "mixed",
      recommendedHorizon: "starter_module",
      suggestedTitle: "Fractions",
      detectedChunks: ["fractions"],
    }),
  });

  assert.equal(result.artifact.sourceKind, "topic_seed");
  assert.equal(result.artifact.entryStrategy, "scaffold_only");
  assert.equal(result.artifact.recommendedHorizon, "starter_module");
  assert.equal(result.artifact.deliveryPattern, "mixed");
});

test("executeSourceInterpret parses an ambiguous conservative result", async () => {
  const { result } = await executeWithMockedSourceInterpret({
    input: {
      learnerName: "Ava",
      requestedRoute: "manual_shell",
      inputModalities: ["text"],
      rawText: "Can you make something from this?",
      extractedText: "Can you make something from this?",
      extractedStructure: null,
      assetRefs: [],
      sourcePackages: [],
      sourceFiles: [],
      titleCandidate: null,
    },
    artifact: buildArtifact({
      sourceKind: "ambiguous",
      entryStrategy: "scaffold_only",
      continuationMode: "manual_review",
      suggestedTitle: "Starter curriculum shell",
      deliveryPattern: "mixed",
      confidence: "low",
      recommendedHorizon: "few_days",
      followUpQuestion: "Should this start from a specific chapter or topic?",
      needsConfirmation: true,
    }),
  });

  assert.equal(result.artifact.sourceKind, "ambiguous");
  assert.equal(result.artifact.confidence, "low");
  assert.equal(result.artifact.needsConfirmation, true);
});

test("executeSourceInterpret rejects legacy source_interpret enums", async () => {
  await assert.rejects(
    executeWithMockedSourceInterpret({
      input: {
        learnerName: "Ava",
        requestedRoute: "single_lesson",
        inputModalities: ["text"],
        rawText: "Old taxonomy check",
        extractedText: "Old taxonomy check",
        extractedStructure: null,
        assetRefs: [],
        sourcePackages: [],
        sourceFiles: [],
        titleCandidate: null,
      },
      artifact: buildArtifact({
        sourceKind: "single_day_material",
      }),
    }),
    /sourceKind/,
  );
});
