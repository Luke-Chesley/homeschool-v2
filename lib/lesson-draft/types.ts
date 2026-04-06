/**
 * Structured Lesson Draft — schema v1.0
 *
 * Replaces the previous markdown-string lesson plan format.
 * Content is generated as structured data; the UI owns layout and presentation.
 */

// ---------------------------------------------------------------------------
// Block type library (bounded — renderer relies on this list)
// ---------------------------------------------------------------------------

export const LESSON_BLOCK_TYPES = [
  "opener",
  "retrieval",
  "warm_up",
  "model",
  "guided_practice",
  "independent_practice",
  "discussion",
  "check_for_understanding",
  "reflection",
  "wrap_up",
  "transition",
  "movement_break",
  "project_work",
  "read_aloud",
  "demonstration",
] as const;

export type LessonBlockType = (typeof LESSON_BLOCK_TYPES)[number];

// ---------------------------------------------------------------------------
// Shared block shape
// ---------------------------------------------------------------------------

export interface LessonBlock {
  type: LessonBlockType;
  /** Short display title, e.g. "Introduce long division" */
  title: string;
  /** Estimated minutes for this block */
  minutes: number;
  /** One sentence: why this block is in the lesson */
  purpose: string;
  /** What the teacher/parent does during this block */
  teacher_action: string;
  /** What the learner does during this block */
  learner_action: string;
  /** Visible progress or comprehension check, if applicable */
  check_for?: string;
  /** Materials specific to this block */
  materials_needed?: string[];
  /** True if block can be dropped when time is tight */
  optional?: boolean;
}

// ---------------------------------------------------------------------------
// Adaptation cases
// ---------------------------------------------------------------------------

export type AdaptationTrigger =
  | "if_struggles"
  | "if_finishes_early"
  | "if_attention_drops"
  | "if_materials_missing"
  | string; // allow freeform triggers beyond the known set

export interface LessonAdaptation {
  trigger: AdaptationTrigger;
  /** Short, actionable instruction for the teacher */
  action: string;
}

// ---------------------------------------------------------------------------
// Lesson shape meta-template (guides block selection, not a rigid script)
// ---------------------------------------------------------------------------

export type LessonShape =
  | "balanced"
  | "direct_instruction"
  | "discussion_heavy"
  | "project_based"
  | "practice_heavy"
  | "gentle_short_blocks";

// ---------------------------------------------------------------------------
// Teacher/parent context (influences generated content, not the schema)
// ---------------------------------------------------------------------------

export interface TeacherContext {
  /** Comfort level with the subject, e.g. "strong", "moderate", "novice" */
  subject_comfort?: string;
  /** How much prep time is available, e.g. "minimal", "moderate", "flexible" */
  prep_tolerance?: string;
  /** General teaching approach, e.g. "hands-on", "discussion-first" */
  teaching_style?: string;
  /** Parent vs credentialed teacher, or other role label */
  role?: string;
}

// ---------------------------------------------------------------------------
// Core structured lesson draft
// ---------------------------------------------------------------------------

export interface StructuredLessonDraft {
  /** Always "1.0" for this format version */
  schema_version: "1.0";

  // --- Required core ---
  title: string;
  /** One sentence describing what this lesson is about */
  lesson_focus: string;
  /** 1–3 learning objectives for this session */
  primary_objectives: string[];
  /** Concrete, observable indicators that the lesson succeeded */
  success_criteria: string[];
  /** Total planned lesson time in minutes */
  total_minutes: number;
  /** Ordered sequence of lesson blocks */
  blocks: LessonBlock[];
  /** All materials needed for the lesson */
  materials: string[];
  /** Short bullet notes for the teacher during live instruction */
  teacher_notes: string[];
  /** Structured adaptation cases (struggles, early finishers, etc.) */
  adaptations: LessonAdaptation[];

  // --- Optional modules (rendered only when present) ---
  /** Pre-lesson prep steps */
  prep?: string[];
  /** Artifact or evidence to collect at end of lesson */
  assessment_artifact?: string;
  /** What to do if learner is ready for more */
  extension?: string;
  /** What to carry forward to the next session */
  follow_through?: string;
  /** Notes for a co-teacher or second adult */
  co_teacher_notes?: string[];
  /** Specific accommodations for this learner */
  accommodations?: string[];
  /** Meta-template that shaped block selection */
  lesson_shape?: LessonShape;
}

// ---------------------------------------------------------------------------
// Legacy format (markdown-only, produced by prompt version ≤ 1.3.0)
// ---------------------------------------------------------------------------

export interface LegacyLessonDraft {
  schema_version: "legacy";
  markdown: string;
}

// ---------------------------------------------------------------------------
// Union type used at the persistence + UI boundary
// ---------------------------------------------------------------------------

export type AnyLessonDraft = StructuredLessonDraft | LegacyLessonDraft;

export function isStructuredLessonDraft(
  draft: AnyLessonDraft,
): draft is StructuredLessonDraft {
  return draft.schema_version === "1.0";
}

export function isLegacyLessonDraft(
  draft: AnyLessonDraft,
): draft is LegacyLessonDraft {
  return draft.schema_version === "legacy";
}
