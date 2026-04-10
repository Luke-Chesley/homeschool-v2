import { z } from "zod";

import { LESSON_BLOCK_TYPES } from "./types.ts";
import type { StructuredLessonDraft, LessonBlock } from "./types.ts";

// ---------------------------------------------------------------------------
// Field length limits (prevents prose-heavy outputs)
// ---------------------------------------------------------------------------

const MAX_SHORT_STRING = 200;
const MAX_ACTION_STRING = 400;
const MAX_BLOCK_TITLE = 100;

// ---------------------------------------------------------------------------
// Block schema
// ---------------------------------------------------------------------------

export const LessonBlockSchema = z.object({
  type: z.enum(LESSON_BLOCK_TYPES),
  title: z.string().min(1).max(MAX_BLOCK_TITLE),
  minutes: z.number().int().positive(),
  purpose: z.string().min(1).max(MAX_SHORT_STRING),
  teacher_action: z.string().min(1).max(MAX_ACTION_STRING),
  learner_action: z.string().min(1).max(MAX_ACTION_STRING),
  check_for: z.string().max(MAX_SHORT_STRING).optional(),
  materials_needed: z.array(z.string().max(MAX_SHORT_STRING)).optional(),
  optional: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Adaptation schema
// ---------------------------------------------------------------------------

const LessonAdaptationSchema = z.object({
  trigger: z.string().min(1).max(80),
  action: z.string().min(1).max(MAX_SHORT_STRING),
});

// ---------------------------------------------------------------------------
// Full lesson draft schema
// ---------------------------------------------------------------------------

export const StructuredLessonDraftSchema = z
  .object({
    schema_version: z.literal("1.0"),
    title: z.string().min(1).max(150),
    lesson_focus: z.string().min(1).max(MAX_SHORT_STRING),
    primary_objectives: z.array(z.string().min(1).max(MAX_SHORT_STRING)).min(1).max(5),
    success_criteria: z.array(z.string().min(1).max(MAX_SHORT_STRING)).min(1).max(6),
    total_minutes: z.number().int().positive(),
    blocks: z.array(LessonBlockSchema).min(1),
    materials: z.array(z.string().max(MAX_SHORT_STRING)),
    teacher_notes: z.array(z.string().max(MAX_SHORT_STRING)),
    adaptations: z.array(LessonAdaptationSchema),

    // Optional modules
    prep: z.array(z.string().max(MAX_SHORT_STRING)).optional(),
    assessment_artifact: z.string().max(MAX_SHORT_STRING).optional(),
    extension: z.string().max(MAX_SHORT_STRING).optional(),
    follow_through: z.string().max(MAX_SHORT_STRING).optional(),
    co_teacher_notes: z.array(z.string().max(MAX_SHORT_STRING)).optional(),
    accommodations: z.array(z.string().max(MAX_SHORT_STRING)).optional(),
    lesson_shape: z
      .enum([
        "balanced",
        "direct_instruction",
        "discussion_heavy",
        "project_based",
        "practice_heavy",
        "gentle_short_blocks",
      ])
      .optional(),
  })
  .superRefine((draft, ctx) => {
    // Rule: block minutes must sum to total_minutes ± 15%
    const blockTotal = draft.blocks.reduce((sum, b) => sum + b.minutes, 0);
    const allowedDelta = Math.ceil(draft.total_minutes * 0.15);
    if (Math.abs(blockTotal - draft.total_minutes) > allowedDelta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Block minutes total (${blockTotal}) differs from total_minutes (${draft.total_minutes}) by more than 15%.`,
        path: ["blocks"],
      });
    }

    // Rule: at least one instructional block
    const instructionalTypes: ReadonlyArray<string> = [
      "model",
      "guided_practice",
      "independent_practice",
      "demonstration",
      "read_aloud",
      "discussion",
      "project_work",
    ];
    const hasInstructional = draft.blocks.some((b) =>
      instructionalTypes.includes(b.type),
    );
    if (!hasInstructional) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Lesson must include at least one instructional block (model, guided_practice, independent_practice, demonstration, read_aloud, discussion, or project_work).",
        path: ["blocks"],
      });
    }

    // Rule: at least one visible check mechanism
    const checkTypes: ReadonlyArray<string> = [
      "check_for_understanding",
      "reflection",
    ];
    const hasCheck =
      draft.blocks.some((b) => checkTypes.includes(b.type)) ||
      draft.blocks.some((b) => b.check_for && b.check_for.length > 0);
    if (!hasCheck) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Lesson must include at least one visible check: a check_for_understanding block, a reflection block, or a check_for field on any block.",
        path: ["blocks"],
      });
    }
  });

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

export type LessonDraftValidationResult =
  | { valid: true; draft: StructuredLessonDraft }
  | { valid: false; errors: string[] };

// ---------------------------------------------------------------------------
// Validate a raw parsed object
// ---------------------------------------------------------------------------

export function validateLessonDraft(
  raw: unknown,
): LessonDraftValidationResult {
  const result = StructuredLessonDraftSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, draft: result.data as StructuredLessonDraft };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
  );
  return { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Prose-heaviness check (rejects outputs that slipped back into narrative)
// ---------------------------------------------------------------------------

const PROSE_SENTENCES_PER_FIELD = 4; // more than this = likely prose

function countSentences(text: string): number {
  // Count sentence-ending punctuation marks as a rough sentence count.
  return (text.match(/[.!?]/g) ?? []).length;
}

export function isProsyBlock(block: LessonBlock): boolean {
  return (
    countSentences(block.teacher_action) > PROSE_SENTENCES_PER_FIELD ||
    countSentences(block.learner_action) > PROSE_SENTENCES_PER_FIELD ||
    countSentences(block.purpose) > 2
  );
}

export function hasProsyContent(draft: StructuredLessonDraft): boolean {
  return draft.blocks.some(isProsyBlock);
}

// ---------------------------------------------------------------------------
// Build correction notes for a retry prompt
// ---------------------------------------------------------------------------

export function buildCorrectionNotes(
  errors: string[],
  proseWarning: boolean,
): string {
  const lines: string[] = [
    "The previous lesson draft failed validation. Correct the following issues and regenerate:",
    "",
  ];
  for (const err of errors) {
    lines.push(`- ${err}`);
  }
  if (proseWarning) {
    lines.push(
      "- Several block fields contain long prose. Keep teacher_action, learner_action, and purpose to 1–2 short sentences each.",
    );
  }
  lines.push("");
  lines.push(
    "Return only valid JSON matching the StructuredLessonDraft schema. Do not add explanatory text.",
  );
  return lines.join("\n");
}
