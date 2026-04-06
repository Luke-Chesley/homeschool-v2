/**
 * Activity generation context builder.
 *
 * Assembles structured ActivitySpecPromptInput from a lesson draft, learner,
 * and teacher context. The lesson draft is the sole generation parent.
 *
 * Hierarchy: curriculum → lesson draft → one lesson activity → evidence/progress
 *
 * Primary entry: buildActivityContextFromLessonDraft()
 *   — lesson draft is the sole content source and generation parent
 *   — plan items provide optional traceability links only (do not drive content)
 *   — scope is always session-level
 */

import type { ActivitySpecPromptInput } from "@/lib/prompts/activity-spec";
import type { PlanItem } from "@/lib/planning/types";
import type { StructuredLessonDraft, LessonBlock } from "@/lib/lesson-draft/types";

// ---------------------------------------------------------------------------
// Context input shapes
// ---------------------------------------------------------------------------

export interface LessonContext {
  title: string;
  purpose?: string;
  objectives: string[];
  subject?: string;
  estimatedMinutes?: number;
  lessonLabel?: string;
  note?: string;
}

/**
 * Compact lesson draft context extracted from a StructuredLessonDraft.
 * Only fields useful for activity generation are included.
 */
export interface LessonDraftContext {
  lessonFocus: string;
  primaryObjectives: string[];
  successCriteria: string[];
  /**
   * Ordered block sequence — type, title, purpose, and learner_action only.
   * Teacher-only content is omitted.
   */
  blocks: Array<{
    type: LessonBlock["type"];
    title: string;
    minutes: number;
    purpose: string;
    learnerAction: string;
    optional?: boolean;
  }>;
  materials: string[];
  teacherNotes: string[];
  adaptations: Array<{ trigger: string; action: string }>;
  assessmentArtifact?: string;
  lessonShape?: string;
}

export interface CurriculumContext {
  sourceTitle?: string;
  subject?: string;
  skillTitle?: string;
  skillPath?: string;
  linkedObjectiveIds?: string[];
  linkedSkillTitles?: string[];
}

export interface LearnerContext {
  name: string;
  gradeLevel?: string;
}

export interface TeacherContext {
  workflowMode?: string;
  materialsAvailable?: string[];
}

export type ActivityScopeKind =
  | "session"
  | "lesson_block"
  | "route_item"
  | "objective_cluster";

export interface ActivityScope {
  kind: ActivityScopeKind;
  label?: string;
  planItemId?: string;
  blockRef?: string;
}

export interface ActivityGenerationContext {
  learner: LearnerContext;
  lesson: LessonContext;
  lessonDraft?: LessonDraftContext;
  curriculum: CurriculumContext;
  teacher?: TeacherContext;
  scope?: ActivityScope;
  templateHint?: string;
  interactionModePreference?: "digital" | "offline" | "hybrid";
  linkedObjectiveIds?: string[];
  linkedSkillTitles?: string[];
}

// ---------------------------------------------------------------------------
// Helper: extract compact LessonDraftContext from StructuredLessonDraft
// ---------------------------------------------------------------------------

export function extractLessonDraftContext(draft: StructuredLessonDraft): LessonDraftContext {
  return {
    lessonFocus: draft.lesson_focus,
    primaryObjectives: draft.primary_objectives,
    successCriteria: draft.success_criteria,
    blocks: draft.blocks.map((block) => ({
      type: block.type,
      title: block.title,
      minutes: block.minutes,
      purpose: block.purpose,
      learnerAction: block.learner_action,
      optional: block.optional,
    })),
    materials: draft.materials,
    teacherNotes: draft.teacher_notes.slice(0, 5),
    adaptations: draft.adaptations.map((a) => ({ trigger: a.trigger, action: a.action })),
    assessmentArtifact: draft.assessment_artifact,
    lessonShape: draft.lesson_shape,
  };
}

// ---------------------------------------------------------------------------
// Primary builder: lesson draft → generation context
// ---------------------------------------------------------------------------

/**
 * Build a generation context owned by a lesson draft.
 *
 * The lesson draft is the sole content source. Plan items (if given) provide
 * traceability links for progress reporting — they do not shape the activity.
 * Scope is always session-level, covering the whole lesson draft.
 */
export function buildActivityContextFromLessonDraft(params: {
  lessonDraft: StructuredLessonDraft;
  learnerName: string;
  workflowMode?: string;
  /** Plan items for traceability only — do not use to shape generation */
  planItems?: PlanItem[];
}): ActivityGenerationContext {
  const { lessonDraft, learnerName, workflowMode, planItems = [] } = params;
  const draftCtx = extractLessonDraftContext(lessonDraft);

  const subjects = [...new Set(planItems.map((p) => p.subject).filter(Boolean))];
  const subject = subjects[0];
  const sourceTitle = planItems[0]?.sourceLabel;
  const linkedSkillTitles = planItems.map((p) => p.title);

  return {
    learner: { name: learnerName },
    lesson: {
      title: lessonDraft.title,
      purpose: lessonDraft.lesson_focus,
      objectives: lessonDraft.primary_objectives,
      subject,
      estimatedMinutes: lessonDraft.total_minutes,
    },
    lessonDraft: draftCtx,
    curriculum: {
      subject,
      sourceTitle,
      linkedSkillTitles,
    },
    teacher: {
      workflowMode,
      materialsAvailable: lessonDraft.materials,
    },
    scope: {
      kind: "session",
      label: lessonDraft.title,
    },
    linkedObjectiveIds: [],
    linkedSkillTitles,
  };
}

// ---------------------------------------------------------------------------
// Builder: context → prompt input
// ---------------------------------------------------------------------------

/**
 * Flatten an ActivityGenerationContext into an ActivitySpecPromptInput
 * ready for the generation prompt.
 */
export function buildPromptInput(
  ctx: ActivityGenerationContext,
  correctionNotes?: string,
): ActivitySpecPromptInput {
  return {
    learnerName: ctx.learner.name,
    learnerGradeLevel: ctx.learner.gradeLevel,
    lessonTitle: ctx.lesson.title,
    lessonPurpose: ctx.lesson.purpose ?? ctx.lesson.objectives[0] ?? ctx.lesson.title,
    lessonObjectives: ctx.lesson.objectives,
    curriculumSubject: ctx.curriculum.subject ?? ctx.lesson.subject ?? "General",
    skillTitle: ctx.curriculum.skillTitle,
    skillPath: ctx.curriculum.skillPath,
    estimatedMinutes: ctx.lesson.estimatedMinutes ?? 20,
    workflowMode: ctx.teacher?.workflowMode,
    materialsAvailable: ctx.teacher?.materialsAvailable,
    lessonDraft: ctx.lessonDraft,
    scope: ctx.scope,
    templateHint: ctx.templateHint,
    interactionModePreference: ctx.interactionModePreference,
    linkedObjectiveIds: ctx.linkedObjectiveIds ?? [],
    linkedSkillTitles: ctx.linkedSkillTitles ?? ctx.curriculum.linkedSkillTitles ?? [],
    correctionNotes,
  };
}
