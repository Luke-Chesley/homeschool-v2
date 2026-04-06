import assert from "node:assert/strict";
import test from "node:test";

import {
  validateLessonDraft,
  hasProsyContent,
  buildCorrectionNotes,
  isProsyBlock,
} from "../lib/lesson-draft/validate.ts";
import {
  isStructuredLessonDraft,
  isLegacyLessonDraft,
  LESSON_BLOCK_TYPES,
} from "../lib/lesson-draft/types.ts";
import {
  buildLessonDraftUserPrompt,
  LESSON_DRAFT_SYSTEM_PROMPT,
  LESSON_DRAFT_PROMPT_VERSION,
} from "../lib/prompts/lesson-draft.ts";
import type { StructuredLessonDraft, LessonBlock } from "../lib/lesson-draft/types.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<LessonBlock> = {}): LessonBlock {
  return {
    type: "model",
    title: "Introduce long division",
    minutes: 10,
    purpose: "Build a shared mental model before practice.",
    teacher_action: "Model two examples on the whiteboard.",
    learner_action: "Watch and ask one clarifying question.",
    ...overrides,
  };
}

function makeValidDraft(overrides: Partial<StructuredLessonDraft> = {}): StructuredLessonDraft {
  return {
    schema_version: "1.0",
    title: "Long Division Introduction",
    lesson_focus: "Introduce the long division algorithm with two-digit divisors.",
    primary_objectives: ["Understand the steps of long division"],
    success_criteria: ["Learner can solve 2 division problems with guidance"],
    total_minutes: 45,
    blocks: [
      makeBlock({ type: "opener", title: "Review multiplication facts", minutes: 5, purpose: "Activate prior knowledge." }),
      makeBlock({ type: "model", title: "Model long division", minutes: 15, purpose: "Introduce algorithm." }),
      makeBlock({ type: "guided_practice", title: "Solve together", minutes: 15, purpose: "Practice with support." }),
      makeBlock({ type: "check_for_understanding", title: "Exit problem", minutes: 5, purpose: "Check readiness.", check_for: "Learner solves one problem independently." }),
      makeBlock({ type: "wrap_up", title: "Summarize steps", minutes: 5, purpose: "Consolidate." }),
    ],
    materials: ["whiteboard", "practice worksheet"],
    teacher_notes: ["Go slow on the first example"],
    adaptations: [
      { trigger: "if_struggles", action: "Return to multiplication review before proceeding." },
    ],
    ...overrides,
  };
}

// Procedural lesson fixture
const proceduralLesson = makeValidDraft({
  title: "Fraction Multiplication",
  lesson_focus: "Apply the multiply-numerators-then-denominators rule.",
  blocks: [
    makeBlock({ type: "retrieval", title: "Recall fraction parts", minutes: 5, purpose: "Activate prior knowledge." }),
    makeBlock({ type: "model", title: "Demonstrate rule", minutes: 10, purpose: "Show the algorithm." }),
    makeBlock({ type: "guided_practice", title: "Work together", minutes: 15, purpose: "Supervised practice." }),
    makeBlock({ type: "independent_practice", title: "Solo problems", minutes: 10, purpose: "Check independent recall." }),
    makeBlock({ type: "check_for_understanding", title: "Quick check", minutes: 5, purpose: "Verify mastery.", check_for: "3/5 correct." }),
  ],
  total_minutes: 45,
});

// Conceptual lesson fixture
const conceptualLesson = makeValidDraft({
  title: "Ecosystems Overview",
  lesson_focus: "Understand how producers, consumers, and decomposers interact.",
  blocks: [
    makeBlock({ type: "warm_up", title: "What do you eat?", minutes: 5, purpose: "Connect concept to experience." }),
    makeBlock({ type: "discussion", title: "Roles in the ecosystem", minutes: 20, purpose: "Build conceptual understanding." }),
    makeBlock({ type: "reflection", title: "Draw a food chain", minutes: 15, purpose: "Synthesize learning.", check_for: "Learner places at least 3 organisms correctly." }),
    makeBlock({ type: "wrap_up", title: "One word summary", minutes: 5, purpose: "Close the loop." }),
  ],
  total_minutes: 45,
});

// Creative lesson fixture
const creativeLesson = makeValidDraft({
  title: "Descriptive Writing",
  lesson_focus: "Use sensory details to make writing vivid.",
  blocks: [
    makeBlock({ type: "read_aloud", title: "Read mentor text", minutes: 10, purpose: "Expose to model writing." }),
    makeBlock({ type: "discussion", title: "Identify sensory language", minutes: 10, purpose: "Name the craft moves." }),
    makeBlock({ type: "independent_practice", title: "Write a scene", minutes: 20, purpose: "Apply the technique." }),
    makeBlock({ type: "reflection", title: "Share one sentence", minutes: 5, purpose: "Celebrate and close.", check_for: "Learner can name one sensory detail they used." }),
  ],
  total_minutes: 45,
});

// Short mixed lesson fixture (tight time budget)
const shortMixedLesson = makeValidDraft({
  title: "Quick Science Check-in",
  lesson_focus: "Review the water cycle before moving on.",
  total_minutes: 20,
  blocks: [
    makeBlock({ type: "retrieval", title: "Label the water cycle", minutes: 8, purpose: "Surface what learner knows." }),
    makeBlock({ type: "discussion", title: "Explain one phase", minutes: 7, purpose: "Deepen understanding." }),
    makeBlock({ type: "check_for_understanding", title: "One question check", minutes: 5, purpose: "Confirm readiness.", check_for: "Learner answers correctly." }),
  ],
});

// Lesson with support/adaptation needs
const supportFocusedLesson = makeValidDraft({
  title: "Reading Comprehension: Main Idea",
  lesson_focus: "Identify the main idea and three supporting details.",
  blocks: [
    makeBlock({ type: "model", title: "Think aloud", minutes: 10, purpose: "Model the thinking process." }),
    makeBlock({ type: "guided_practice", title: "Annotate together", minutes: 15, purpose: "Scaffold identification." }),
    makeBlock({ type: "independent_practice", title: "Solo passage", minutes: 15, optional: true, purpose: "Independent application." }),
    makeBlock({ type: "check_for_understanding", title: "Oral retell", minutes: 5, purpose: "Check comprehension.", check_for: "Learner states main idea in own words." }),
  ],
  total_minutes: 45,
  adaptations: [
    { trigger: "if_struggles", action: "Use a shorter paragraph and have learner highlight only topic sentences." },
    { trigger: "if_finishes_early", action: "Have learner find a second supporting detail or write a summary sentence." },
    { trigger: "if_attention_drops", action: "Switch to oral discussion instead of written annotation for 5 minutes." },
    { trigger: "if_materials_missing", action: "Use any available book page; concept applies to any text." },
  ],
});

// ---------------------------------------------------------------------------
// Schema version type guards
// ---------------------------------------------------------------------------

test("isStructuredLessonDraft returns true for schema_version 1.0", () => {
  const draft = makeValidDraft();
  assert.ok(isStructuredLessonDraft(draft));
  assert.equal(isLegacyLessonDraft(draft), false);
});

test("isLegacyLessonDraft returns true for schema_version legacy", () => {
  const legacy = { schema_version: "legacy" as const, markdown: "# Lesson\n\nContent here." };
  assert.ok(isLegacyLessonDraft(legacy));
  assert.equal(isStructuredLessonDraft(legacy), false);
});

// ---------------------------------------------------------------------------
// Block type library
// ---------------------------------------------------------------------------

test("LESSON_BLOCK_TYPES contains required instructional types", () => {
  const required = [
    "model",
    "guided_practice",
    "independent_practice",
    "demonstration",
    "read_aloud",
    "discussion",
    "project_work",
  ] as const;
  for (const t of required) {
    assert.ok(
      LESSON_BLOCK_TYPES.includes(t),
      `Missing instructional block type: ${t}`,
    );
  }
});

test("LESSON_BLOCK_TYPES contains check/reflection types", () => {
  assert.ok(LESSON_BLOCK_TYPES.includes("check_for_understanding"));
  assert.ok(LESSON_BLOCK_TYPES.includes("reflection"));
});

test("LESSON_BLOCK_TYPES has exactly 15 entries (bounded library)", () => {
  assert.equal(LESSON_BLOCK_TYPES.length, 15);
});

// ---------------------------------------------------------------------------
// Core validation — required fields
// ---------------------------------------------------------------------------

test("validateLessonDraft accepts a valid structured draft", () => {
  const result = validateLessonDraft(makeValidDraft());
  assert.ok(result.valid, `Expected valid but got errors: ${result.valid ? "" : result.errors.join(", ")}`);
});

test("validateLessonDraft rejects missing schema_version", () => {
  const bad = { ...makeValidDraft(), schema_version: undefined };
  const result = validateLessonDraft(bad);
  assert.equal(result.valid, false);
});

test("validateLessonDraft rejects empty title", () => {
  const bad = makeValidDraft({ title: "" });
  const result = validateLessonDraft(bad);
  assert.equal(result.valid, false);
});

test("validateLessonDraft rejects empty primary_objectives", () => {
  const bad = makeValidDraft({ primary_objectives: [] });
  const result = validateLessonDraft(bad);
  assert.equal(result.valid, false);
});

test("validateLessonDraft rejects empty success_criteria", () => {
  const bad = makeValidDraft({ success_criteria: [] });
  const result = validateLessonDraft(bad);
  assert.equal(result.valid, false);
});

test("validateLessonDraft rejects empty blocks", () => {
  const bad = makeValidDraft({ blocks: [] });
  const result = validateLessonDraft(bad);
  assert.equal(result.valid, false);
});

// ---------------------------------------------------------------------------
// Block type validation
// ---------------------------------------------------------------------------

test("validateLessonDraft rejects unknown block type", () => {
  const bad = makeValidDraft({
    blocks: [
      // @ts-expect-error intentionally bad type
      makeBlock({ type: "magic_lesson_type" }),
      makeBlock({ type: "check_for_understanding", minutes: 44 }),
    ],
  });
  const result = validateLessonDraft(bad);
  assert.equal(result.valid, false);
});

// ---------------------------------------------------------------------------
// Total time consistency
// ---------------------------------------------------------------------------

test("validateLessonDraft accepts drafts where block minutes match total_minutes exactly", () => {
  const draft = makeValidDraft({
    total_minutes: 45,
    blocks: [
      makeBlock({ type: "model", minutes: 20 }),
      makeBlock({ type: "guided_practice", minutes: 15 }),
      makeBlock({ type: "check_for_understanding", minutes: 10, check_for: "Correct." }),
    ],
  });
  const result = validateLessonDraft(draft);
  assert.ok(result.valid, `Expected valid: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

test("validateLessonDraft accepts draft where block total is within 15% of total_minutes", () => {
  // total_minutes = 45, block total = 42 (within 15%)
  const draft = makeValidDraft({
    total_minutes: 45,
    blocks: [
      makeBlock({ type: "model", minutes: 20 }),
      makeBlock({ type: "guided_practice", minutes: 15 }),
      makeBlock({ type: "check_for_understanding", minutes: 7, check_for: "Correct." }),
    ],
  });
  const result = validateLessonDraft(draft);
  assert.ok(result.valid, `Expected valid: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

test("validateLessonDraft rejects draft where block total diverges from total_minutes by > 15%", () => {
  const draft = makeValidDraft({
    total_minutes: 45,
    blocks: [
      makeBlock({ type: "model", minutes: 5 }),
      makeBlock({ type: "guided_practice", minutes: 5 }),
      makeBlock({ type: "check_for_understanding", minutes: 5, check_for: "Correct." }),
    ],
  });
  const result = validateLessonDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid && result.errors.some((e) => e.includes("Block minutes total")),
    "Expected time consistency error",
  );
});

// ---------------------------------------------------------------------------
// Instructional block requirement
// ---------------------------------------------------------------------------

test("validateLessonDraft rejects lesson with no instructional block", () => {
  const draft = makeValidDraft({
    total_minutes: 20,
    blocks: [
      makeBlock({ type: "opener", minutes: 5, purpose: "Start." }),
      makeBlock({ type: "transition", minutes: 5, purpose: "Move." }),
      makeBlock({ type: "check_for_understanding", minutes: 5, purpose: "Check.", check_for: "Done." }),
      makeBlock({ type: "wrap_up", minutes: 5, purpose: "End." }),
    ],
  });
  const result = validateLessonDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid && result.errors.some((e) => e.includes("instructional block")),
    "Expected instructional block error",
  );
});

// ---------------------------------------------------------------------------
// Check mechanism requirement
// ---------------------------------------------------------------------------

test("validateLessonDraft rejects lesson with no visible check mechanism", () => {
  const draft = makeValidDraft({
    total_minutes: 30,
    blocks: [
      makeBlock({ type: "opener", minutes: 5, purpose: "Start." }),
      makeBlock({ type: "model", minutes: 15, purpose: "Teach." }),
      makeBlock({ type: "guided_practice", minutes: 10, purpose: "Practice." }),
    ],
  });
  const result = validateLessonDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid && result.errors.some((e) => e.includes("visible check")),
    "Expected visible check error",
  );
});

test("validateLessonDraft accepts lesson where check_for field provides check mechanism", () => {
  const draft = makeValidDraft({
    total_minutes: 30,
    blocks: [
      makeBlock({ type: "opener", minutes: 5, purpose: "Start." }),
      makeBlock({ type: "model", minutes: 15, purpose: "Teach.", check_for: "Learner can restate the concept." }),
      makeBlock({ type: "guided_practice", minutes: 10, purpose: "Practice." }),
    ],
  });
  const result = validateLessonDraft(draft);
  assert.ok(result.valid, `Expected valid: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

// ---------------------------------------------------------------------------
// Optional module rendering
// ---------------------------------------------------------------------------

test("validateLessonDraft accepts a draft with no optional modules", () => {
  const draft = makeValidDraft();
  // Remove all optional fields
  delete (draft as Partial<StructuredLessonDraft>).prep;
  delete (draft as Partial<StructuredLessonDraft>).extension;
  delete (draft as Partial<StructuredLessonDraft>).follow_through;
  const result = validateLessonDraft(draft);
  assert.ok(result.valid);
});

test("validateLessonDraft accepts a draft with all optional modules populated", () => {
  const draft = makeValidDraft({
    prep: ["Print practice worksheet"],
    assessment_artifact: "Completed division problem",
    extension: "Attempt three-digit divisor problems",
    follow_through: "Review errors tomorrow before new content",
    co_teacher_notes: ["Supervise step 3"],
    accommodations: ["Allow calculator for first two problems"],
    lesson_shape: "direct_instruction",
  });
  const result = validateLessonDraft(draft);
  assert.ok(result.valid, `Expected valid: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

// ---------------------------------------------------------------------------
// Prose-heaviness detection
// ---------------------------------------------------------------------------

test("isProsyBlock returns false for concise blocks", () => {
  const block = makeBlock({
    teacher_action: "Show two examples on the board.",
    learner_action: "Watch and ask one question.",
    purpose: "Build shared understanding.",
  });
  assert.equal(isProsyBlock(block), false);
});

test("isProsyBlock returns true for blocks with long narrative fields", () => {
  // Five sentences — exceeds the prose threshold of 4
  const block = makeBlock({
    teacher_action:
      "Begin by introducing the concept in general terms. Then explain the first step carefully. After that, move to the second step slowly. Demonstrate the third step on the board. Ask if there are any questions.",
    learner_action: "Listen carefully and take notes on the board.",
    purpose: "Provide a thorough foundation.",
  });
  assert.ok(isProsyBlock(block), "Expected block to be detected as prosy");
});

test("hasProsyContent returns true when any block is prosy", () => {
  const draft = makeValidDraft({
    blocks: [
      makeBlock({ type: "opener", minutes: 5, purpose: "Start." }),
      makeBlock({
        type: "model",
        minutes: 25,
        purpose: "Explain the main concept.",
        teacher_action:
          "Start with a brief overview. Then go into the first detail. Next cover the second detail. Finally, summarize and check for questions. Repeat if needed.",
        learner_action: "Listen and take notes.",
        check_for: "Learner can repeat steps.",
      }),
      makeBlock({ type: "check_for_understanding", minutes: 15, purpose: "Check.", check_for: "Done." }),
    ],
  });
  assert.ok(hasProsyContent(draft));
});

test("hasProsyContent returns false for all-concise drafts", () => {
  const draft = makeValidDraft();
  assert.equal(hasProsyContent(draft), false);
});

// ---------------------------------------------------------------------------
// Correction notes for retry
// ---------------------------------------------------------------------------

test("buildCorrectionNotes includes each error", () => {
  const errors = ["blocks: time mismatch", "blocks: no instructional block"];
  const notes = buildCorrectionNotes(errors, false);
  assert.ok(notes.includes("time mismatch"));
  assert.ok(notes.includes("no instructional block"));
});

test("buildCorrectionNotes includes prose warning when flagged", () => {
  const notes = buildCorrectionNotes([], true);
  assert.ok(notes.includes("prose"));
});

test("buildCorrectionNotes ends with JSON instruction", () => {
  const notes = buildCorrectionNotes(["some error"], false);
  assert.ok(notes.includes("Return only valid JSON"));
});

// ---------------------------------------------------------------------------
// Fixture: different lesson shapes validate correctly
// ---------------------------------------------------------------------------

test("proceduralLesson fixture passes validation", () => {
  const result = validateLessonDraft(proceduralLesson);
  assert.ok(result.valid, `Procedural: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

test("conceptualLesson fixture passes validation", () => {
  const result = validateLessonDraft(conceptualLesson);
  assert.ok(result.valid, `Conceptual: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

test("creativeLesson fixture passes validation", () => {
  const result = validateLessonDraft(creativeLesson);
  assert.ok(result.valid, `Creative: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

test("shortMixedLesson fixture passes validation", () => {
  const result = validateLessonDraft(shortMixedLesson);
  assert.ok(result.valid, `Short mixed: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

test("supportFocusedLesson fixture passes validation", () => {
  const result = validateLessonDraft(supportFocusedLesson);
  assert.ok(result.valid, `Support focused: ${result.valid ? "" : (result as { valid: false; errors: string[] }).errors.join(", ")}`);
});

// Adaptation triggers are present and actionable
test("supportFocusedLesson has all four standard adaptation triggers", () => {
  const triggers = supportFocusedLesson.adaptations.map((a) => a.trigger);
  assert.ok(triggers.includes("if_struggles"));
  assert.ok(triggers.includes("if_finishes_early"));
  assert.ok(triggers.includes("if_attention_drops"));
  assert.ok(triggers.includes("if_materials_missing"));
});

// ---------------------------------------------------------------------------
// Prompt system
// ---------------------------------------------------------------------------

test("LESSON_DRAFT_SYSTEM_PROMPT instructs JSON-only output", () => {
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("Return valid JSON only"));
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("No markdown"));
});

test("LESSON_DRAFT_SYSTEM_PROMPT disallows prose/paragraphs", () => {
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("No paragraphs"));
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("No narrative"));
});

test("LESSON_DRAFT_SYSTEM_PROMPT references block type list", () => {
  // Should contain at least a few block types from the library
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("model"));
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("guided_practice"));
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("check_for_understanding"));
});

test("LESSON_DRAFT_SYSTEM_PROMPT requires instructional + check blocks", () => {
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("at least one instructional block"));
  assert.ok(LESSON_DRAFT_SYSTEM_PROMPT.includes("at least one visible check"));
});

test("LESSON_DRAFT_PROMPT_VERSION is 2.0.0", () => {
  assert.equal(LESSON_DRAFT_PROMPT_VERSION, "2.0.0");
});

test("buildLessonDraftUserPrompt includes learner name and date", () => {
  const prompt = buildLessonDraftUserPrompt({
    learnerName: "Mia",
    sourceTitle: "Math Curriculum",
    dateLabel: "Monday, April 6",
    itemCount: 3,
    totalMinutes: 45,
    objectiveCount: 2,
    objectives: ["Master multiplication facts", "Apply to word problems"],
    routeItems: [
      {
        title: "Multiplication facts review",
        subject: "Math",
        estimatedMinutes: 15,
        objective: "Recall facts 1-12",
        lessonLabel: "Lesson 12",
      },
    ],
    materials: ["worksheet", "flashcards"],
  });

  assert.ok(prompt.includes("Mia"));
  assert.ok(prompt.includes("Monday, April 6"));
  assert.ok(prompt.includes("Math Curriculum"));
  assert.ok(prompt.includes("45 minutes"));
  assert.ok(prompt.includes("Return only valid JSON"));
});

test("buildLessonDraftUserPrompt includes lessonShape when provided", () => {
  const prompt = buildLessonDraftUserPrompt({
    learnerName: "Sam",
    sourceTitle: "Science",
    dateLabel: "Tuesday",
    itemCount: 1,
    totalMinutes: 30,
    objectiveCount: 1,
    objectives: ["Understand photosynthesis"],
    routeItems: [],
    materials: [],
    lessonShape: "discussion_heavy",
  });
  assert.ok(prompt.includes("discussion_heavy"));
});

test("buildLessonDraftUserPrompt includes teacherContext when provided", () => {
  const prompt = buildLessonDraftUserPrompt({
    learnerName: "Sam",
    sourceTitle: "Science",
    dateLabel: "Tuesday",
    itemCount: 1,
    totalMinutes: 30,
    objectiveCount: 1,
    objectives: ["Understand photosynthesis"],
    routeItems: [],
    materials: [],
    teacherContext: {
      subject_comfort: "novice",
      prep_tolerance: "minimal",
    },
  });
  assert.ok(prompt.includes("novice"));
  assert.ok(prompt.includes("minimal"));
});

// ---------------------------------------------------------------------------
// Route/objective alignment
// ---------------------------------------------------------------------------

test("buildLessonDraftUserPrompt includes all route items", () => {
  const prompt = buildLessonDraftUserPrompt({
    learnerName: "Alex",
    sourceTitle: "History",
    dateLabel: "Wednesday",
    itemCount: 2,
    totalMinutes: 60,
    objectiveCount: 2,
    objectives: ["Obj A", "Obj B"],
    routeItems: [
      { title: "American Revolution", subject: "History", estimatedMinutes: 30, objective: "Obj A", lessonLabel: "Lesson 1" },
      { title: "Boston Tea Party", subject: "History", estimatedMinutes: 30, objective: "Obj B", lessonLabel: "Lesson 2" },
    ],
    materials: [],
  });
  assert.ok(prompt.includes("American Revolution"));
  assert.ok(prompt.includes("Boston Tea Party"));
  assert.ok(prompt.includes("Obj A"));
  assert.ok(prompt.includes("Obj B"));
});

test("buildLessonDraftUserPrompt includes week highlights when provided", () => {
  const prompt = buildLessonDraftUserPrompt({
    learnerName: "Alex",
    sourceTitle: "History",
    dateLabel: "Wednesday",
    itemCount: 1,
    totalMinutes: 45,
    objectiveCount: 1,
    objectives: ["Obj A"],
    routeItems: [],
    materials: [],
    weekHighlights: ["Focus on primary sources this week"],
  });
  assert.ok(prompt.includes("Focus on primary sources this week"));
});
