/**
 * Tests for the structured activity runtime:
 *   - ActivitySpec schema validation
 *   - Component library coverage
 *   - Scoring / progress mapping
 *   - Spec builder (fallback generation)
 *   - Evidence model
 *   - Offline activity handling
 *   - Invalid spec rejection
 */

import assert from "node:assert/strict";
import test from "node:test";

import { validateActivitySpec } from "../lib/activities/validation.ts";
import { parseActivitySpec, isActivitySpec } from "../lib/activities/spec.ts";
import { COMPONENT_TYPE_LIST, INTERACTIVE_COMPONENT_TYPES } from "../lib/activities/components.ts";
import { interpretScore } from "../lib/activities/scoring.ts";
import type { ActivitySpec } from "../lib/activities/spec.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const minimalValidSpec: ActivitySpec = {
  schemaVersion: "2",
  title: "Place Value Practice",
  purpose: "Practice identifying digit place values in 5-digit numbers.",
  activityKind: "guided_practice",
  linkedObjectiveIds: [],
  linkedSkillTitles: ["place value"],
  estimatedMinutes: 15,
  interactionMode: "digital",
  components: [
    {
      type: "paragraph",
      id: "intro",
      text: "Work through the following steps.",
    },
    {
      type: "short_answer",
      id: "q1",
      prompt: "What is the value of the digit 4 in 34,827?",
      hint: "Think about which place the 4 occupies.",
      required: true,
    },
    {
      type: "confidence_check",
      id: "confidence",
      prompt: "How confident are you?",
      labels: ["Not yet", "A little", "Getting there", "Pretty good", "Got it!"],
    },
  ],
  completionRules: { strategy: "all_interactive_components" },
  evidenceSchema: {
    captureKinds: ["answer_response", "confidence_signal"],
    requiresReview: false,
    autoScorable: false,
  },
  scoringModel: {
    mode: "completion_based",
    masteryThreshold: 0.8,
    reviewThreshold: 0.6,
  },
};

const offlineSpec: ActivitySpec = {
  schemaVersion: "2",
  title: "Outdoor Nature Walk",
  purpose: "Observe and record 5 plants in the local area.",
  activityKind: "offline_real_world",
  linkedObjectiveIds: [],
  linkedSkillTitles: ["plant identification"],
  estimatedMinutes: 30,
  interactionMode: "offline",
  components: [
    {
      type: "observation_record",
      id: "obs-record",
      prompt: "Record observations from your nature walk.",
      fields: [
        { id: "plant-name", label: "Plant name", inputKind: "text" },
        { id: "color", label: "Color", inputKind: "text" },
        { id: "leaf-type", label: "Leaf type", inputKind: "text" },
      ],
      filledBy: "learner",
    },
    {
      type: "image_capture",
      id: "photo",
      prompt: "Upload a photo of your favourite plant.",
      required: false,
    },
    {
      type: "reflection_prompt",
      id: "reflect",
      prompt: "Nature walk reflection",
      subPrompts: [
        { id: "r1", text: "What surprised you?", responseKind: "text" },
        { id: "r2", text: "Confidence rating", responseKind: "rating" },
      ],
      required: true,
    },
  ],
  completionRules: { strategy: "any_submission" },
  evidenceSchema: {
    captureKinds: ["teacher_observation", "image_artifact", "reflection_response"],
    requiresReview: true,
    autoScorable: false,
    reviewerNotes: "Review photos and check that learner can name 3+ plants.",
  },
  scoringModel: {
    mode: "teacher_observed",
    masteryThreshold: 0.8,
    reviewThreshold: 0.6,
  },
  offlineMode: {
    offlineTaskDescription: "Go for a 20-minute walk and find 5 different plants.",
    materials: ["notebook", "pencil", "camera/phone"],
    evidenceCaptureInstruction: "Take photos and fill in the observation record after the walk.",
  },
};

// ---------------------------------------------------------------------------
// Test: schema validation
// ---------------------------------------------------------------------------

test("validateActivitySpec — accepts a valid spec", () => {
  const result = validateActivitySpec(minimalValidSpec);
  assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join(", ")}`);
  assert.equal(result.errors.length, 0);
});

test("validateActivitySpec — accepts a valid offline spec", () => {
  const result = validateActivitySpec(offlineSpec);
  assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join(", ")}`);
});

test("validateActivitySpec — rejects unknown component type", () => {
  const bad = {
    ...minimalValidSpec,
    components: [
      ...minimalValidSpec.components,
      { type: "arbitrary_code_block", id: "bad", code: "alert('xss')" },
    ],
  };
  const result = validateActivitySpec(bad);
  // Zod's discriminated union rejects the unknown type — spec must be invalid
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0, "Expected at least one error for unknown component type");
});

test("validateActivitySpec — rejects spec with no interactive components", () => {
  const bad = {
    ...minimalValidSpec,
    components: [
      { type: "paragraph", id: "p1", text: "Just text." },
    ],
  };
  const result = validateActivitySpec(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("interactive component")));
});

test("validateActivitySpec — rejects duplicate component IDs", () => {
  const bad = {
    ...minimalValidSpec,
    components: [
      { type: "short_answer", id: "q1", prompt: "First", required: true },
      { type: "short_answer", id: "q1", prompt: "Duplicate", required: true },
    ],
  };
  const result = validateActivitySpec(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("unique")));
});

test("validateActivitySpec — rejects minimum_components without count", () => {
  const bad = {
    ...minimalValidSpec,
    completionRules: { strategy: "minimum_components" as const },
  };
  const result = validateActivitySpec(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("minimumComponents")));
});

// ---------------------------------------------------------------------------
// Test: isActivitySpec / parseActivitySpec
// ---------------------------------------------------------------------------

test("isActivitySpec — detects v2 spec by schemaVersion", () => {
  assert.equal(isActivitySpec(minimalValidSpec), true);
  assert.equal(isActivitySpec({ kind: "quiz", title: "x" }), false);
  assert.equal(isActivitySpec(null), false);
  assert.equal(isActivitySpec(undefined), false);
});

test("parseActivitySpec — parses valid spec", () => {
  const spec = parseActivitySpec(minimalValidSpec);
  assert.ok(spec);
  assert.equal(spec?.schemaVersion, "2");
  assert.equal(spec?.title, "Place Value Practice");
});

test("parseActivitySpec — returns null for invalid spec", () => {
  assert.equal(parseActivitySpec({ schemaVersion: "2", title: "" }), null);
  assert.equal(parseActivitySpec(null), null);
  assert.equal(parseActivitySpec("not an object"), null);
});

// ---------------------------------------------------------------------------
// Test: component library
// ---------------------------------------------------------------------------

test("COMPONENT_TYPE_LIST — contains all expected types", () => {
  const expected = [
    "heading", "paragraph", "callout", "image", "divider",
    "short_answer", "text_response", "rich_text_response",
    "single_select", "multi_select", "rating", "confidence_check",
    "checklist", "ordered_sequence", "matching_pairs",
    "categorization", "sort_into_groups", "label_map", "hotspot_select",
    "build_steps", "drag_arrange",
    "reflection_prompt", "rubric_self_check",
    "file_upload", "image_capture", "audio_capture",
    "observation_record", "teacher_checkoff",
    "compare_and_explain", "choose_next_step", "construction_space",
  ];
  for (const type of expected) {
    assert.ok(COMPONENT_TYPE_LIST.includes(type as typeof COMPONENT_TYPE_LIST[number]),
      `Missing component type: ${type}`);
  }
});

test("INTERACTIVE_COMPONENT_TYPES — does not include content-only types", () => {
  const contentOnly = ["heading", "paragraph", "callout", "image", "divider"];
  for (const type of contentOnly) {
    assert.equal(
      INTERACTIVE_COMPONENT_TYPES.includes(type as typeof INTERACTIVE_COMPONENT_TYPES[number]),
      false,
      `Content type should not be interactive: ${type}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test: scoring / progress mapping
// ---------------------------------------------------------------------------

test("interpretScore — correctness_based mastered", () => {
  const signal = interpretScore({
    model: { mode: "correctness_based", masteryThreshold: 0.8, reviewThreshold: 0.6 },
    scorePercent: 90,
    completedAt: new Date().toISOString(),
  });
  assert.equal(signal.status, "mastered");
  assert.equal(signal.requiresReview, false);
});

test("interpretScore — correctness_based needs_review", () => {
  const signal = interpretScore({
    model: { mode: "correctness_based", masteryThreshold: 0.8, reviewThreshold: 0.6 },
    scorePercent: 50,
    completedAt: new Date().toISOString(),
  });
  assert.equal(signal.status, "needs_review");
  assert.equal(signal.requiresReview, true);
});

test("interpretScore — completion_based always progressing", () => {
  const signal = interpretScore({
    model: { mode: "completion_based", masteryThreshold: 0.8, reviewThreshold: 0.6 },
    completedAt: new Date().toISOString(),
  });
  assert.equal(signal.status, "completed_no_score");
  assert.equal(signal.requiresReview, false);
});

test("interpretScore — teacher_observed always pending review", () => {
  const signal = interpretScore({
    model: { mode: "teacher_observed", masteryThreshold: 0.8, reviewThreshold: 0.6 },
    completedAt: new Date().toISOString(),
  });
  assert.equal(signal.status, "evidence_pending");
  assert.equal(signal.requiresReview, true);
});

test("interpretScore — confidence_report mastered at high confidence", () => {
  const signal = interpretScore({
    model: {
      mode: "confidence_report",
      masteryThreshold: 0.8,
      reviewThreshold: 0.6,
      confidenceMasteryLevel: 4,
    },
    confidenceLevel: 4,
    completedAt: new Date().toISOString(),
  });
  assert.equal(signal.status, "progressing");
  assert.equal(signal.requiresReview, false);
});

// ---------------------------------------------------------------------------
// Test: spec with teacher support
// ---------------------------------------------------------------------------

test("spec with teacherSupport — validates and preserves all fields", () => {
  const spec: ActivitySpec = {
    ...minimalValidSpec,
    teacherSupport: {
      setupNotes: "Review the lesson before starting.",
      discussionQuestions: ["What did you notice?", "How would you explain this?"],
      masteryIndicators: ["Can identify place values in 5-digit numbers"],
      commonMistakes: "Confusing tens and hundreds places.",
      extensionIdeas: "Try 6-digit numbers.",
    },
  };
  const result = validateActivitySpec(spec);
  assert.equal(result.valid, true);

  const parsed = parseActivitySpec(spec);
  assert.ok(parsed?.teacherSupport?.setupNotes);
  assert.equal(parsed?.teacherSupport?.discussionQuestions?.length, 2);
});

// ---------------------------------------------------------------------------
// Test: offline activity spec
// ---------------------------------------------------------------------------

test("offline activity spec — validates and has offlineMode config", () => {
  const result = validateActivitySpec(offlineSpec);
  assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join(", ")}`);

  const spec = parseActivitySpec(offlineSpec);
  assert.ok(spec);
  assert.equal(spec?.interactionMode, "offline");
  assert.ok(spec?.offlineMode?.offlineTaskDescription);
  assert.equal(spec?.activityKind, "offline_real_world");
  assert.equal(spec?.evidenceSchema.requiresReview, true);
  assert.equal(spec?.scoringModel.mode, "teacher_observed");
});

// ---------------------------------------------------------------------------
// Test: digital interactive activity with correctness-based scoring
// ---------------------------------------------------------------------------

test("single_select spec — validates and configures scoring correctly", () => {
  const spec: ActivitySpec = {
    schemaVersion: "2",
    title: "Retrieval Check",
    purpose: "Test recall of place value concepts.",
    activityKind: "retrieval",
    linkedObjectiveIds: [],
    linkedSkillTitles: [],
    estimatedMinutes: 10,
    interactionMode: "digital",
    components: [
      {
        type: "single_select",
        id: "q1",
        prompt: "What is the value of 4 in 34,827?",
        choices: [
          { id: "a", text: "4" },
          { id: "b", text: "40" },
          { id: "c", text: "4,000", correct: true },
          { id: "d", text: "40,000" },
        ],
        immediateCorrectness: false,
        required: true,
      },
      {
        type: "confidence_check",
        id: "conf",
        prompt: "How confident are you?",
        labels: ["Not yet", "A little", "Getting there", "Pretty good", "Got it!"],
      },
    ],
    completionRules: { strategy: "all_interactive_components" },
    evidenceSchema: {
      captureKinds: ["answer_response", "confidence_signal"],
      requiresReview: false,
      autoScorable: true,
    },
    scoringModel: {
      mode: "correctness_based",
      masteryThreshold: 0.8,
      reviewThreshold: 0.5,
    },
  };

  const result = validateActivitySpec(spec);
  assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join(", ")}`);
  // autoScorable + correctness_based should not trigger warnings
  assert.equal(result.warnings.length, 0, `Got unexpected warnings: ${result.warnings.join(", ")}`);
});

// ---------------------------------------------------------------------------
// Test: project step with rubric evidence
// ---------------------------------------------------------------------------

test("project step with rubric self-check — validates", () => {
  const spec: ActivitySpec = {
    schemaVersion: "2",
    title: "Story Draft — Self-Review",
    purpose: "Review your story draft against the writing rubric.",
    activityKind: "project_step",
    linkedObjectiveIds: [],
    linkedSkillTitles: ["narrative writing"],
    estimatedMinutes: 20,
    interactionMode: "digital",
    components: [
      {
        type: "callout",
        id: "intro",
        variant: "info",
        text: "Review your draft before submitting. Use the rubric to score each criterion.",
      },
      {
        type: "rubric_self_check",
        id: "rubric",
        prompt: "Score your draft on the following criteria:",
        criteria: [
          { id: "clarity", label: "Clarity", description: "Is the story easy to follow?" },
          { id: "detail", label: "Detail", description: "Are there enough specific details?" },
          { id: "voice", label: "Voice", description: "Does the writing sound like you?" },
        ],
        levels: [
          { value: 1, label: "Beginning" },
          { value: 2, label: "Developing" },
          { value: 3, label: "Meeting" },
          { value: 4, label: "Exceeding" },
        ],
        notePrompt: "What will you revise before your final draft?",
      },
      {
        type: "file_upload",
        id: "draft-upload",
        prompt: "Upload your current draft.",
        accept: [".pdf", ".doc", ".docx"],
        maxFiles: 1,
        required: false,
      },
    ],
    completionRules: { strategy: "minimum_components", minimumComponents: 1 },
    evidenceSchema: {
      captureKinds: ["rubric_score", "file_artifact", "self_assessment"],
      requiresReview: true,
      autoScorable: false,
      reviewerNotes: "Review rubric scores and uploaded draft.",
    },
    scoringModel: {
      mode: "rubric_based",
      masteryThreshold: 0.8,
      reviewThreshold: 0.6,
      rubricMasteryLevel: 3,
    },
  };

  const result = validateActivitySpec(spec);
  assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join(", ")}`);
});

// ---------------------------------------------------------------------------
// Test: reflection + confidence capture
// ---------------------------------------------------------------------------

test("reflection activity — validates and captures confidence signal", () => {
  const spec: ActivitySpec = {
    schemaVersion: "2",
    title: "Session Reflection",
    purpose: "Reflect on what was learned and capture confidence.",
    activityKind: "reflection",
    linkedObjectiveIds: [],
    linkedSkillTitles: [],
    estimatedMinutes: 5,
    interactionMode: "digital",
    components: [
      {
        type: "reflection_prompt",
        id: "main-reflect",
        prompt: "Lesson reflection",
        subPrompts: [
          { id: "r1", text: "What is one thing you learned?", responseKind: "text" },
          { id: "r2", text: "What was confusing?", responseKind: "text" },
        ],
        required: true,
      },
      {
        type: "confidence_check",
        id: "conf",
        prompt: "How confident do you feel about this topic?",
        labels: ["Not yet", "A little", "Getting there", "Pretty good", "Got it!"],
      },
    ],
    completionRules: { strategy: "all_interactive_components" },
    evidenceSchema: {
      captureKinds: ["reflection_response", "confidence_signal"],
      requiresReview: false,
      autoScorable: false,
    },
    scoringModel: {
      mode: "confidence_report",
      masteryThreshold: 0.8,
      reviewThreshold: 0.6,
      confidenceMasteryLevel: 4,
    },
  };

  const result = validateActivitySpec(spec);
  assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join(", ")}`);

  const parsed = parseActivitySpec(spec);
  assert.ok(parsed);
  assert.equal(parsed?.activityKind, "reflection");
  assert.equal(parsed?.evidenceSchema.captureKinds.includes("confidence_signal"), true);
});

// ---------------------------------------------------------------------------
// Test: lesson-draft context builder
// ---------------------------------------------------------------------------

import {
  buildActivityContextFromLessonDraft,
  extractLessonDraftContext,
  buildPromptInput,
} from "../lib/activities/generation-context.ts";
import type { StructuredLessonDraft } from "../lib/lesson-draft/types.ts";
import type { PlanItem } from "../lib/planning/types.ts";

const sampleLessonDraft: StructuredLessonDraft = {
  schema_version: "1.0",
  title: "Long Division — Step by Step",
  lesson_focus: "Master the standard algorithm for long division with 3-digit dividends.",
  primary_objectives: [
    "Perform long division with a 1-digit divisor",
    "Identify remainder and check by multiplying back",
  ],
  success_criteria: [
    "Learner can correctly divide a 3-digit number by a 1-digit number",
    "Learner explains each step without prompting",
  ],
  total_minutes: 40,
  blocks: [
    {
      type: "retrieval",
      title: "Warm-up multiplication facts",
      minutes: 5,
      purpose: "Activate prior knowledge of multiplication needed for division",
      teacher_action: "Ask 6 quick multiplication questions",
      learner_action: "Answer 6 multiplication questions verbally",
    },
    {
      type: "model",
      title: "Teacher models long division",
      minutes: 10,
      purpose: "Show the step-by-step procedure",
      teacher_action: "Work through 2 examples on whiteboard",
      learner_action: "Watch and take notes",
    },
    {
      type: "guided_practice",
      title: "Guided problem set",
      minutes: 15,
      purpose: "Practice with support",
      teacher_action: "Circulate and prompt as needed",
      learner_action: "Solve 4 problems in workbook",
    },
    {
      type: "reflection",
      title: "Session reflection",
      minutes: 5,
      purpose: "Consolidate learning",
      teacher_action: "Ask reflection questions",
      learner_action: "Write 2 sentences about what they learned",
    },
  ],
  materials: ["Math workbook p.42", "Whiteboard", "Pencil"],
  teacher_notes: [
    "Emphasize D-M-S-B (divide, multiply, subtract, bring down)",
    "Check remainder is less than divisor",
  ],
  adaptations: [
    { trigger: "if_struggles", action: "Use smaller numbers, work one step at a time" },
    { trigger: "if_finishes_early", action: "Try 4-digit dividends" },
  ],
  assessment_artifact: "Completed workbook page with 4 problems",
};

const samplePlanItem: PlanItem = {
  id: "route-item-123",
  date: "2026-04-05",
  title: "Long Division",
  subject: "Math",
  kind: "lesson",
  objective: "Practice long division with 3-digit numbers",
  estimatedMinutes: 40,
  status: "ready",
  standards: [],
  goals: [],
  materials: ["Math workbook"],
  artifactSlots: ["work sample"],
  copilotPrompts: [],
  sourceLabel: "Math Curriculum",
  lessonLabel: "Math · Division · Long Division",
  curriculum: {
    sourceId: "src-math",
    skillNodeId: "skill-long-div",
    weeklyRouteItemId: "route-item-123",
    origin: "curriculum_route",
  },
};

test("buildActivityContextFromLessonDraft — uses lesson draft as content source", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    workflowMode: "family_guided",
    planItems: [samplePlanItem],
  });

  assert.equal(ctx.lesson.title, "Long Division — Step by Step");
  assert.equal(ctx.lesson.purpose, sampleLessonDraft.lesson_focus);
  assert.deepEqual(ctx.lesson.objectives, sampleLessonDraft.primary_objectives);
  assert.equal(ctx.lesson.estimatedMinutes, 40);
  assert.ok(ctx.lessonDraft, "lessonDraft context must be present");
  assert.equal(ctx.lessonDraft!.lessonFocus, sampleLessonDraft.lesson_focus);
  assert.equal(ctx.lessonDraft!.blocks.length, 4);
  assert.deepEqual(ctx.lessonDraft!.successCriteria, sampleLessonDraft.success_criteria);
  assert.equal(ctx.lessonDraft!.assessmentArtifact, "Completed workbook page with 4 problems");
});

test("buildActivityContextFromLessonDraft — scope is always session-level", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    workflowMode: "family_guided",
    planItems: [samplePlanItem],
  });

  assert.equal(ctx.scope?.kind, "session");
  assert.equal(ctx.scope?.label, sampleLessonDraft.title);
});

test("buildActivityContextFromLessonDraft — plan items provide traceability, not scope", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    planItems: [samplePlanItem],
  });

  assert.equal(ctx.curriculum.sourceTitle, "Math Curriculum");
  assert.equal(ctx.lesson.subject, "Math");
  assert.ok(ctx.linkedSkillTitles?.includes("Long Division"));
  // Scope is still session-level despite plan item being present
  assert.equal(ctx.scope?.kind, "session");
});

test("buildActivityContextFromLessonDraft — materials come from lesson draft", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    planItems: [samplePlanItem],
  });

  assert.deepEqual(ctx.teacher?.materialsAvailable, ["Math workbook p.42", "Whiteboard", "Pencil"]);
});

test("extractLessonDraftContext — produces compact representation", () => {
  const draftCtx = extractLessonDraftContext(sampleLessonDraft);

  assert.equal(draftCtx.lessonFocus, sampleLessonDraft.lesson_focus);
  assert.equal(draftCtx.blocks.length, 4);
  // Only learner_action is included — teacher_action is not
  assert.ok(!("teacher_action" in draftCtx.blocks[0]!));
  assert.equal(draftCtx.blocks[0]!.learnerAction, "Answer 6 multiplication questions verbally");
  assert.equal(draftCtx.adaptations.length, 2);
  assert.equal(draftCtx.assessmentArtifact, "Completed workbook page with 4 problems");
});

test("buildPromptInput — includes lessonDraft and session scope from lesson draft context", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    planItems: [samplePlanItem],
  });
  const input = buildPromptInput(ctx);

  assert.ok(input.lessonDraft, "prompt input must include lessonDraft");
  assert.equal(input.lessonDraft!.lessonFocus, sampleLessonDraft.lesson_focus);
  assert.equal(input.scope?.kind, "session");
  assert.ok(input.linkedSkillTitles?.includes("Long Division"));
});

// ---------------------------------------------------------------------------
// Test: lesson-draft fingerprinting and ownership hierarchy
// ---------------------------------------------------------------------------

import { computeLessonDraftFingerprint } from "../lib/lesson-draft/fingerprint.ts";

test("buildActivityContextFromLessonDraft — scope is session-level, not route_item", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    workflowMode: "family_guided",
    planItems: [samplePlanItem],
  });

  // Scope is always session — covers the whole lesson draft
  assert.equal(ctx.scope?.kind, "session");
  assert.equal(ctx.scope?.label, sampleLessonDraft.title);
});

test("buildActivityContextFromLessonDraft — lesson draft is the content source", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
  });

  assert.equal(ctx.lesson.title, sampleLessonDraft.title);
  assert.equal(ctx.lesson.purpose, sampleLessonDraft.lesson_focus);
  assert.deepEqual(ctx.lesson.objectives, sampleLessonDraft.primary_objectives);
  assert.ok(ctx.lessonDraft, "lessonDraft context must be present");
  assert.equal(ctx.lessonDraft!.blocks.length, 4);
});

test("buildActivityContextFromLessonDraft — plan items are traceability only", () => {
  const planItem2: PlanItem = {
    ...samplePlanItem,
    id: "route-item-456",
    title: "Long Division Practice",
    subject: "Math",
  };

  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    planItems: [samplePlanItem, planItem2],
  });

  // Linked skill titles come from plan items (traceability)
  assert.ok(ctx.linkedSkillTitles?.includes("Long Division"));
  assert.ok(ctx.linkedSkillTitles?.includes("Long Division Practice"));
  // But scope is still session-level — plan items don't change it
  assert.equal(ctx.scope?.kind, "session");
});

test("buildActivityContextFromLessonDraft — works with no plan items", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    workflowMode: "family_guided",
  });

  assert.equal(ctx.scope?.kind, "session");
  assert.deepEqual(ctx.linkedSkillTitles, []);
  assert.equal(ctx.lesson.title, sampleLessonDraft.title);
});

test("computeLessonDraftFingerprint — same draft produces same fingerprint", () => {
  const fp1 = computeLessonDraftFingerprint(sampleLessonDraft);
  const fp2 = computeLessonDraftFingerprint(sampleLessonDraft);
  assert.equal(fp1, fp2, "fingerprint must be deterministic");
  assert.equal(fp1.length, 16, "fingerprint is 16 hex chars");
});

test("computeLessonDraftFingerprint — different content produces different fingerprint", () => {
  const fp1 = computeLessonDraftFingerprint(sampleLessonDraft);
  const modified: typeof sampleLessonDraft = {
    ...sampleLessonDraft,
    lesson_focus: "A completely different focus for this lesson",
  };
  const fp2 = computeLessonDraftFingerprint(modified);
  assert.notEqual(fp1, fp2, "changed draft must produce different fingerprint");
});

test("computeLessonDraftFingerprint — different blocks produce different fingerprint", () => {
  const fp1 = computeLessonDraftFingerprint(sampleLessonDraft);
  const reordered: typeof sampleLessonDraft = {
    ...sampleLessonDraft,
    blocks: [...sampleLessonDraft.blocks].reverse(), // reorder blocks
  };
  const fp2 = computeLessonDraftFingerprint(reordered);
  assert.notEqual(fp1, fp2, "reordered blocks must produce different fingerprint");
});

test("computeLessonDraftFingerprint — skill overlap does not cause fingerprint match", () => {
  // Two lesson drafts that mention the same skill but have different content
  const draftA: typeof sampleLessonDraft = {
    ...sampleLessonDraft,
    title: "Long Division — Day 1",
    lesson_focus: "Introduction to long division",
  };
  const draftB: typeof sampleLessonDraft = {
    ...sampleLessonDraft,
    title: "Long Division — Day 2",
    lesson_focus: "Practice long division with remainders",
  };
  const fpA = computeLessonDraftFingerprint(draftA);
  const fpB = computeLessonDraftFingerprint(draftB);
  assert.notEqual(fpA, fpB, "overlapping skills must not cause fingerprint collision");
});

test("buildActivityContextFromLessonDraft — primary: prompt input has lesson draft, session scope", () => {
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    workflowMode: "family_guided",
    planItems: [samplePlanItem],
  });
  const input = buildPromptInput(ctx);

  assert.ok(input.lessonDraft, "prompt input must include lessonDraft");
  assert.equal(input.scope?.kind, "session");
  // Plan items appear as linked skill titles (traceability)
  assert.ok(input.linkedSkillTitles?.includes("Long Division"));
});

test("activity hierarchy: one lesson draft → one session-scoped activity context", () => {
  // Verify the canonical hierarchy is enforced in context construction.
  // Two plan items in the same session should produce ONE session-scoped context.
  const planItem2: PlanItem = {
    ...samplePlanItem,
    id: "route-item-789",
    title: "Division Review",
    subject: "Math",
  };

  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    planItems: [samplePlanItem, planItem2],
  });

  // One context, session-scoped — not one per plan item
  assert.equal(ctx.scope?.kind, "session");
  assert.equal(ctx.lesson.title, sampleLessonDraft.title);
  assert.equal(ctx.linkedSkillTitles?.length, 2); // both items as traceability
});

test("evidence/progress traceability: context retains linked skill titles", () => {
  // Skills/objectives are preserved as traceability links in generated context
  const ctx = buildActivityContextFromLessonDraft({
    lessonDraft: sampleLessonDraft,
    learnerName: "Alex",
    planItems: [samplePlanItem],
  });

  // Skill titles are available for evidence → objective → curriculum mapping
  assert.ok(Array.isArray(ctx.linkedSkillTitles));
  assert.ok(ctx.linkedSkillTitles!.length > 0, "skill titles must be retained for traceability");
  assert.ok(Array.isArray(ctx.linkedObjectiveIds));
});
