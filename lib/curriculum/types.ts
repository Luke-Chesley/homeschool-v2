/**
 * Curriculum domain types.
 *
 * These are feature-local interfaces so the curriculum module can run
 * independently of the data-layer (plan 02). When the repository layer is
 * merged, concrete implementations can satisfy these same interfaces.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Source types
// ---------------------------------------------------------------------------

export type CurriculumSourceKind =
  | "manual"      // hand-typed by parent
  | "upload"      // PDF / document ingested
  | "ai_draft"    // AI-generated skeleton
  | "external";   // imported from a third-party resource

export const CurriculumSourceKindSchema = z.enum([
  "manual",
  "upload",
  "ai_draft",
  "external",
]);

// ---------------------------------------------------------------------------
// Curriculum tree node shapes
// ---------------------------------------------------------------------------

export const CurriculumSourceSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  kind: CurriculumSourceKindSchema,
  /** ISO-8601 date string or partial year like "2025-2026" */
  academicYear: z.string().optional(),
  /** Ordered list of subject tags, e.g. ["math", "algebra"] */
  subjects: z.array(z.string()).default([]),
  /** Grade levels this source targets, e.g. ["4", "5"] */
  gradeLevels: z.array(z.string()).default([]),
  /** Storage path if source is a document upload */
  storagePath: z.string().optional(),
  /** Integration points: chunk/index jobs can read this flag */
  indexingStatus: z.enum(["pending", "indexed", "failed", "not_applicable"]).default("not_applicable"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumSource = z.infer<typeof CurriculumSourceSchema>;

export const CurriculumUnitSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  sequence: z.number().int().nonnegative(),
  estimatedWeeks: z.number().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumUnit = z.infer<typeof CurriculumUnitSchema>;

export const CurriculumLessonSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  sequence: z.number().int().nonnegative(),
  /** Estimated duration in minutes */
  estimatedMinutes: z.number().optional(),
  /** Material/resource notes */
  materials: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumLesson = z.infer<typeof CurriculumLessonSchema>;

export const CurriculumObjectiveSchema = z.object({
  id: z.string().uuid(),
  /** Objectives can hang from a lesson or directly from a unit */
  lessonId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  description: z.string().min(1),
  /** IDs of standards mapped to this objective */
  standardIds: z.array(z.string()).default([]),
  /** Custom goal IDs (free-form goals not tied to a standards framework) */
  customGoalIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumObjective = z.infer<typeof CurriculumObjectiveSchema>;

// ---------------------------------------------------------------------------
// Flat tree helper
// ---------------------------------------------------------------------------

export interface CurriculumTree {
  source: CurriculumSource;
  units: Array<{
    unit: CurriculumUnit;
    lessons: Array<{
      lesson: CurriculumLesson;
      objectives: CurriculumObjective[];
    }>;
    objectives: CurriculumObjective[];
  }>;
}

// ---------------------------------------------------------------------------
// Create-input schemas (for forms / API mutations)
// ---------------------------------------------------------------------------

export const CreateCurriculumSourceInputSchema = CurriculumSourceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  indexingStatus: true,
});
export type CreateCurriculumSourceInput = z.infer<typeof CreateCurriculumSourceInputSchema>;

export const CreateCurriculumUnitInputSchema = CurriculumUnitSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateCurriculumUnitInput = z.infer<typeof CreateCurriculumUnitInputSchema>;

export const CreateCurriculumLessonInputSchema = CurriculumLessonSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateCurriculumLessonInput = z.infer<typeof CreateCurriculumLessonInputSchema>;

export const CreateCurriculumObjectiveInputSchema = CurriculumObjectiveSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateCurriculumObjectiveInput = z.infer<typeof CreateCurriculumObjectiveInputSchema>;
