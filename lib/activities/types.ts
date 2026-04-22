/**
 * Activity domain types.
 *
 * Activities are defined by a schema (not executable code) and rendered by
 * the activity engine. This keeps AI-generated content safe and auditable.
 *
 * Supported activity kinds:
 *   quiz          — multiple-choice or short-answer questions
 *   matching      — drag/click pairs
 *   flashcards    — two-sided card deck with flip
 *   sequencing    — reorder items
 *   guided_practice — step-by-step worked problems
 *   reflection    — open-ended text/journal response
 *   checklist     — checklist / completion confirmation
 *   rubric_response — rubric-scored response with criteria
 *   file_submission — upload metadata + submission note
 *   supervisor_sign_off — learner request for adult sign-off
 *   hybrid_layout — allowlisted component composition for rich lessons
 */

import { z } from "zod";

import { ActivityComponentFeedbackSchema } from "./feedback";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const RichTextSchema = z.object({
  /** Plain text fallback */
  text: z.string(),
  /** Optional markdown — renderer decides whether to parse */
  markdown: z.string().optional(),
});
export type RichText = z.infer<typeof RichTextSchema>;

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export const QuizChoiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** Only populated in answer key, not sent to learner */
  correct: z.boolean().optional(),
  explanation: z.string().optional(),
});

export const QuizQuestionSchema = z.object({
  id: z.string(),
  kind: z.literal("multiple_choice"),
  prompt: RichTextSchema,
  choices: z.array(QuizChoiceSchema).min(2),
  /** Answer key — omit when sending to learner */
  correctChoiceIds: z.array(z.string()).optional(),
  hint: z.string().optional(),
});

export const ShortAnswerQuestionSchema = z.object({
  id: z.string(),
  kind: z.literal("short_answer"),
  prompt: RichTextSchema,
  /** Rubric for the parent/grader */
  rubric: z.string().optional(),
  hint: z.string().optional(),
});

export const QuizActivitySchema = z.object({
  kind: z.literal("quiz"),
  title: z.string(),
  instructions: z.string().optional(),
  questions: z.array(z.discriminatedUnion("kind", [QuizQuestionSchema, ShortAnswerQuestionSchema])),
  /** If true, show correctness after each answer; if false, show at end */
  immediateFeeback: z.boolean().default(true),
  passingScore: z.number().min(0).max(1).optional(),
});

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export const MatchingPairSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  answer: z.string(),
  /** Optional image URL for prompt or answer */
  promptImageUrl: z.string().url().optional(),
  answerImageUrl: z.string().url().optional(),
});

export const MatchingActivitySchema = z.object({
  kind: z.literal("matching"),
  title: z.string(),
  instructions: z.string().optional(),
  pairs: z.array(MatchingPairSchema).min(2),
});

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

export const FlashcardSchema = z.object({
  id: z.string(),
  front: RichTextSchema,
  back: RichTextSchema,
});

export const FlashcardsActivitySchema = z.object({
  kind: z.literal("flashcards"),
  title: z.string(),
  instructions: z.string().optional(),
  cards: z.array(FlashcardSchema).min(1),
  /** If true, randomize card order each session */
  randomize: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Sequencing
// ---------------------------------------------------------------------------

export const SequencingItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** Correct 0-based index */
  correctIndex: z.number().int().nonnegative(),
});

export const SequencingActivitySchema = z.object({
  kind: z.literal("sequencing"),
  title: z.string(),
  instructions: z.string().optional(),
  items: z.array(SequencingItemSchema).min(2),
  prompt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Guided practice
// ---------------------------------------------------------------------------

export const GuidedStepSchema = z.object({
  id: z.string(),
  instruction: RichTextSchema,
  /** Hint shown on request */
  hint: z.string().optional(),
  /** If set, learner must enter a value and it is compared to this */
  expectedValue: z.string().optional(),
});

export const GuidedPracticeActivitySchema = z.object({
  kind: z.literal("guided_practice"),
  title: z.string(),
  instructions: z.string().optional(),
  steps: z.array(GuidedStepSchema).min(1),
  workedExample: RichTextSchema.optional(),
});

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------

export const ReflectionPromptSchema = z.object({
  id: z.string(),
  prompt: RichTextSchema,
  /** "text" = free-form textarea; "rating" = 1-5 scale */
  responseKind: z.enum(["text", "rating"]),
  /** For rating kind */
  ratingLabels: z.tuple([z.string(), z.string()]).optional(),
});

export const ReflectionActivitySchema = z.object({
  kind: z.literal("reflection"),
  title: z.string(),
  instructions: z.string().optional(),
  prompts: z.array(ReflectionPromptSchema).min(1),
});

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export const ChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional().default(true),
});

export const ChecklistActivitySchema = z.object({
  kind: z.literal("checklist"),
  title: z.string(),
  instructions: z.string().optional(),
  items: z.array(ChecklistItemSchema).min(1),
  allowPartialSubmit: z.boolean().optional().default(true),
});

// ---------------------------------------------------------------------------
// Rubric response
// ---------------------------------------------------------------------------

export const RubricLevelSchema = z.object({
  value: z.number().int().positive(),
  label: z.string(),
  description: z.string().optional(),
});

export const RubricCriterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export const RubricResponseActivitySchema = z.object({
  kind: z.literal("rubric_response"),
  title: z.string(),
  instructions: z.string().optional(),
  prompt: RichTextSchema.optional(),
  criteria: z.array(RubricCriterionSchema).min(1),
  levels: z.array(RubricLevelSchema).min(2),
  notePrompt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// File submission
// ---------------------------------------------------------------------------

export const FileSubmissionActivitySchema = z.object({
  kind: z.literal("file_submission"),
  title: z.string(),
  instructions: z.string().optional(),
  prompt: RichTextSchema.optional(),
  accept: z.array(z.string()).optional(),
  maxFiles: z.number().int().positive().optional(),
  notePrompt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Supervisor sign-off
// ---------------------------------------------------------------------------

export const SupervisorSignOffItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export const SupervisorSignOffActivitySchema = z.object({
  kind: z.literal("supervisor_sign_off"),
  title: z.string(),
  instructions: z.string().optional(),
  prompt: RichTextSchema.optional(),
  items: z.array(SupervisorSignOffItemSchema).optional(),
  notePrompt: z.string().optional(),
  acknowledgmentLabel: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Hybrid layout
// ---------------------------------------------------------------------------

/** Safe allowlisted component types for hybrid layouts */
export const HybridComponentKindSchema = z.enum([
  "heading",
  "paragraph",
  "image",
  "video_embed",
  "callout",
  "divider",
  "quiz_embed",
  "flashcard_embed",
  "reflection_embed",
]);
export type HybridComponentKind = z.infer<typeof HybridComponentKindSchema>;

export const HybridComponentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.number().int().min(1).max(6), text: z.string() }),
  z.object({ type: z.literal("paragraph"), content: RichTextSchema }),
  z.object({ type: z.literal("image"), src: z.string().url(), alt: z.string(), caption: z.string().optional() }),
  z.object({ type: z.literal("video_embed"), src: z.string().url(), caption: z.string().optional() }),
  z.object({ type: z.literal("callout"), variant: z.enum(["info", "tip", "warning", "note"]), content: RichTextSchema }),
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("quiz_embed"), activityId: z.string() }),
  z.object({ type: z.literal("flashcard_embed"), activityId: z.string() }),
  z.object({ type: z.literal("reflection_embed"), activityId: z.string() }),
]);
export type HybridComponent = z.infer<typeof HybridComponentSchema>;

export interface HybridLayoutActivity {
  kind: "hybrid_layout";
  title: string;
  components: HybridComponent[];
  /** Embedded activity definitions (keyed by activityId) */
  embeds?: Record<string, ActivityDefinition>;
}

// ---------------------------------------------------------------------------
// ActivityDefinition union (TypeScript only — no Zod schema for the union
// because the circular HybridLayout reference makes Zod inference difficult).
// For runtime parsing, validate each concrete schema directly.
// ---------------------------------------------------------------------------

export type ActivityDefinition =
  | z.infer<typeof QuizActivitySchema>
  | z.infer<typeof MatchingActivitySchema>
  | z.infer<typeof FlashcardsActivitySchema>
  | z.infer<typeof SequencingActivitySchema>
  | z.infer<typeof GuidedPracticeActivitySchema>
  | z.infer<typeof ReflectionActivitySchema>
  | z.infer<typeof ChecklistActivitySchema>
  | z.infer<typeof RubricResponseActivitySchema>
  | z.infer<typeof FileSubmissionActivitySchema>
  | z.infer<typeof SupervisorSignOffActivitySchema>
  | HybridLayoutActivity;

export type ActivityKind = ActivityDefinition["kind"];

/**
 * Parse an unknown value as an ActivityDefinition.
 * Tries each schema in turn. Returns null if none match.
 */
export function parseActivityDefinition(value: unknown): ActivityDefinition | null {
  const schemas = [
    QuizActivitySchema,
    MatchingActivitySchema,
    FlashcardsActivitySchema,
    SequencingActivitySchema,
    GuidedPracticeActivitySchema,
    ReflectionActivitySchema,
    ChecklistActivitySchema,
    RubricResponseActivitySchema,
    FileSubmissionActivitySchema,
    SupervisorSignOffActivitySchema,
  ] as const;

  for (const schema of schemas) {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
  }

  // Try hybrid layout (manual check since it's recursive)
  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value as Record<string, unknown>).kind === "hybrid_layout"
  ) {
    return value as HybridLayoutActivity;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Activity session / assignment
// ---------------------------------------------------------------------------

export interface ActivitySession {
  id: string;
  learnerId: string;
  /** Reference to the durable activity record — ID only, not the definition */
  activityId: string;
  /** Embedded definition for offline/render use */
  definition: ActivityDefinition;
  status: "not_started" | "in_progress" | "completed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  /** Estimated duration in minutes */
  estimatedMinutes?: number;
  /** For linking back to a curriculum lesson */
  lessonId?: string;
  /** Standards covered */
  standardIds: string[];
}

// ---------------------------------------------------------------------------
// Attempt state (captured per-session)
// ---------------------------------------------------------------------------

/** Generic answer shape — each renderer knows how to interpret this */
export const AttemptAnswerSchema = z.object({
  questionId: z.string(),
  /** Raw value; can be a string, array, number, or object depending on kind */
  value: z.unknown(),
  /** Set by the engine when answer is graded */
  correct: z.boolean().optional(),
  /** Fractional score when the engine returns partial credit */
  score: z.number().min(0).max(1).optional(),
  /** Time taken for this question (ms) */
  timeMs: z.number().optional(),
});
export type AttemptAnswer = z.infer<typeof AttemptAnswerSchema>;

export const ActivityAttemptSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  learnerId: z.string(),
  activityId: z.string(),
  /** Draft answers — populated while in-progress, for autosave/resume */
  answers: z.array(AttemptAnswerSchema).default([]),
  /** Score 0-1 when completed */
  score: z.number().min(0).max(1).optional(),
  status: z.enum(["in_progress", "submitted", "graded"]).default("in_progress"),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime().optional(),
  /** Serialized UI state for resume (e.g. current card index) */
  uiState: z.record(z.string(), z.unknown()).optional(),
  /** Persisted runtime feedback keyed by component ID */
  componentFeedback: z.record(z.string(), ActivityComponentFeedbackSchema).optional(),
});
export type ActivityAttempt = z.infer<typeof ActivityAttemptSchema>;

// ---------------------------------------------------------------------------
// Outcome (what gets reported to tracking)
// ---------------------------------------------------------------------------

export const ActivityOutcomeSchema = z.object({
  attemptId: z.string(),
  sessionId: z.string(),
  learnerId: z.string(),
  activityId: z.string(),
  lessonId: z.string().optional(),
  score: z.number().min(0).max(1).optional(),
  timeSpentMs: z.number().optional(),
  completedAt: z.string().datetime(),
  standardIds: z.array(z.string()).default([]),
  /** Any additional metadata */
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ActivityOutcome = z.infer<typeof ActivityOutcomeSchema>;

export const ActivitySubmitResponseSchema = z.object({
  attempt: ActivityAttemptSchema,
  outcome: ActivityOutcomeSchema,
});
export type ActivitySubmitResponse = z.infer<typeof ActivitySubmitResponseSchema>;
