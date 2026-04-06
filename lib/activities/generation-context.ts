/**
 * Activity generation context builder.
 *
 * Assembles structured ActivitySpecPromptInput from lesson, curriculum,
 * learner, and plan context. Activity generation is grounded in lesson
 * purpose and evidence needs — not standalone content.
 */

import type { ActivitySpecPromptInput } from "@/lib/prompts/activity-spec";
import type { PlanItem } from "@/lib/planning/types";

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

export interface ActivityGenerationContext {
  learner: LearnerContext;
  lesson: LessonContext;
  curriculum: CurriculumContext;
  teacher?: TeacherContext;
  templateHint?: string;
  interactionModePreference?: "digital" | "offline" | "hybrid";
  linkedObjectiveIds?: string[];
  linkedSkillTitles?: string[];
}

// ---------------------------------------------------------------------------
// Builder: plan item → generation context
// ---------------------------------------------------------------------------

/**
 * Build a generation context from a PlanItem.
 * This is the primary entry point used by the assignment service.
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
    templateHint: ctx.templateHint,
    interactionModePreference: ctx.interactionModePreference,
    linkedObjectiveIds: ctx.linkedObjectiveIds ?? [],
    linkedSkillTitles: ctx.linkedSkillTitles ?? ctx.curriculum.linkedSkillTitles ?? [],
    correctionNotes,
  };
}
