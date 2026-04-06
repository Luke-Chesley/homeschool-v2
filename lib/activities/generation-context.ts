/**
 * Activity generation context builder.
 *
 * Assembles structured ActivitySpecPromptInput from lesson, curriculum,
 * learner, and plan context. Activity generation is grounded in lesson
 * purpose, structure, and evidence needs — not standalone plan-item metadata.
 *
 * Primary entry: buildContextFromLessonSession()
 * Fallback entry: buildContextFromPlanItem() (used when no lesson draft exists)
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
 * Only fields useful for activity generation are included — we do not
 * dump the full lesson draft as prose.
 */
export interface LessonDraftContext {
  /** One-sentence focus for the session */
  lessonFocus: string;
  /** 1–3 learning objectives */
  primaryObjectives: string[];
  /** Observable mastery indicators */
  successCriteria: string[];
  /**
   * Ordered block sequence — type, title, purpose, and learner_action only.
   * Teacher-only content (teacher_action, internal notes) is omitted.
   */
  blocks: Array<{
    type: LessonBlock["type"];
    title: string;
    minutes: number;
    purpose: string;
    learnerAction: string;
    optional?: boolean;
  }>;
  /** All materials needed */
  materials: string[];
  /** Short teacher notes (up to 5 most actionable) */
  teacherNotes: string[];
  /** Structured adaptation cases */
  adaptations: Array<{ trigger: string; action: string }>;
  /** Evidence or artifact to collect at end */
  assessmentArtifact?: string;
  /** Meta-template that shaped the lesson */
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

/**
 * ActivityScope — how this activity is positioned within the lesson.
 * Activities are primarily owned by a lesson session; scope refines which
 * part of the lesson the activity targets.
 */
export type ActivityScopeKind =
  | "session"            // covers the whole session / lesson
  | "lesson_block"       // targets a specific block in the lesson
  | "route_item"         // scoped to a specific curriculum route item
  | "objective_cluster"; // targets a grouping of objectives

export interface ActivityScope {
  kind: ActivityScopeKind;
  /** Human-readable label for the scope target */
  label?: string;
  /** For route_item scope: the plan item id */
  planItemId?: string;
  /** For lesson_block scope: the block title or index */
  blockRef?: string;
}

export interface ActivityGenerationContext {
  learner: LearnerContext;
  lesson: LessonContext;
  /**
   * Structured lesson draft content — the primary generation input when
   * available. Contains blocks, success criteria, adaptations, etc.
   * When present, the model should use this to shape the activity design.
   * When absent, the activity is generated from plan item metadata alone.
   */
  lessonDraft?: LessonDraftContext;
  curriculum: CurriculumContext;
  teacher?: TeacherContext;
  /** Activity scope within the lesson */
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
    // Limit teacher notes to avoid flooding the prompt
    teacherNotes: draft.teacher_notes.slice(0, 5),
    adaptations: draft.adaptations.map((a) => ({ trigger: a.trigger, action: a.action })),
    assessmentArtifact: draft.assessment_artifact,
    lessonShape: draft.lesson_shape,
  };
}

// ---------------------------------------------------------------------------
// Primary builder: lesson draft + optional plan item → generation context
// ---------------------------------------------------------------------------

/**
 * Build a generation context centered on a structured lesson draft.
 * This is the primary production path when a lesson draft is available.
 *
 * The lesson draft is the primary content source; the plan item (if given)
 * provides curriculum linkage, subject, and scope.
 */
export function buildContextFromLessonSession(params: {
  lessonDraft: StructuredLessonDraft;
  planItem?: PlanItem;
  learnerName: string;
  workflowMode?: string;
}): ActivityGenerationContext {
  const { lessonDraft, planItem, learnerName, workflowMode } = params;
  const draftCtx = extractLessonDraftContext(lessonDraft);

  const subject = planItem?.subject;
  const estimatedMinutes = lessonDraft.total_minutes ?? planItem?.estimatedMinutes;

  // Materials come from the lesson draft first; fall back to plan item
  const materials = lessonDraft.materials.length > 0
    ? lessonDraft.materials
    : (planItem?.materials ?? []);

  return {
    learner: { name: learnerName },
    lesson: {
      title: lessonDraft.title,
      purpose: lessonDraft.lesson_focus,
      objectives: lessonDraft.primary_objectives,
      subject,
      estimatedMinutes,
      lessonLabel: planItem?.lessonLabel,
    },
    lessonDraft: draftCtx,
    curriculum: {
      subject,
      sourceTitle: planItem?.sourceLabel,
      linkedSkillTitles: planItem ? [planItem.title] : [],
    },
    teacher: {
      workflowMode,
      materialsAvailable: materials,
    },
    scope: planItem
      ? {
          kind: "route_item",
          label: planItem.title,
          planItemId: planItem.id,
        }
      : {
          kind: "session",
          label: lessonDraft.title,
        },
    linkedObjectiveIds: [],
    linkedSkillTitles: planItem ? [planItem.title] : [],
  };
}

// ---------------------------------------------------------------------------
// Fallback builder: plan item → generation context
// ---------------------------------------------------------------------------

/**
 * Build a generation context from a PlanItem alone.
 * Used as a fallback when no structured lesson draft is available.
 */
export function buildContextFromPlanItem(
  planItem: PlanItem,
  learnerName: string,
  workflowMode?: string,
): ActivityGenerationContext {
  return {
    learner: {
      name: learnerName,
    },
    lesson: {
      title: planItem.title,
      purpose: planItem.objective,
      objectives: [planItem.objective].filter(Boolean),
      subject: planItem.subject,
      estimatedMinutes: planItem.estimatedMinutes,
      lessonLabel: planItem.lessonLabel,
    },
    curriculum: {
      subject: planItem.subject,
      linkedSkillTitles: [],
    },
    teacher: {
      workflowMode,
      materialsAvailable: planItem.materials ?? [],
    },
    scope: {
      kind: "route_item",
      label: planItem.title,
      planItemId: planItem.id,
    },
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
