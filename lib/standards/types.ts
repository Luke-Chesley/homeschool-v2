/**
 * Standards domain types.
 *
 * Supports any standards framework (CCSS, NGSS, custom, etc.) through a
 * common structure. Custom goals are modeled as a lightweight framework so
 * they participate in the same mapping flows as formal standards.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Framework
// ---------------------------------------------------------------------------

export const StandardsFrameworkSchema = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string(),
  description: z.string().optional(),
  subjects: z.array(z.string()).default([]),
  gradeLevels: z.array(z.string()).default([]),
  /** "ccss" | "ngss" | "custom" | other string */
  kind: z.string(),
  publishedYear: z.number().optional(),
});

export type StandardsFramework = z.infer<typeof StandardsFrameworkSchema>;

// ---------------------------------------------------------------------------
// Standard node (can be nested via parentId)
// ---------------------------------------------------------------------------

export const StandardSchema = z.object({
  id: z.string(),
  frameworkId: z.string(),
  /** Human-readable code, e.g. "CCSS.MATH.CONTENT.4.NBT.A.1" */
  code: z.string(),
  title: z.string(),
  description: z.string().optional(),
  /** Grade or grade-band, e.g. "4" or "K-2" */
  gradeLevel: z.string().optional(),
  subject: z.string().optional(),
  domain: z.string().optional(),
  /** For nested standards (cluster -> standard -> sub-standard) */
  parentId: z.string().optional(),
  depth: z.number().int().nonnegative().default(0),
  hasChildren: z.boolean().optional(),
});

export type Standard = z.infer<typeof StandardSchema>;

// ---------------------------------------------------------------------------
// Custom goal (household-specific, not from a published framework)
// ---------------------------------------------------------------------------

export const CustomGoalSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CustomGoal = z.infer<typeof CustomGoalSchema>;

export const CreateCustomGoalInputSchema = CustomGoalSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateCustomGoalInput = z.infer<typeof CreateCustomGoalInputSchema>;

// ---------------------------------------------------------------------------
// Standards mapping (objective <-> standard/goal)
// ---------------------------------------------------------------------------

export const StandardsMappingSchema = z.object({
  id: z.string(),
  objectiveId: z.string(),
  standardId: z.string().optional(),
  customGoalId: z.string().optional(),
  /** How the standard relates to the objective */
  relationship: z.enum(["primary", "supporting", "related"]).default("primary"),
  createdAt: z.string().datetime(),
});

export type StandardsMapping = z.infer<typeof StandardsMappingSchema>;

// ---------------------------------------------------------------------------
// Search / filter params
// ---------------------------------------------------------------------------

export interface StandardsSearchParams {
  frameworkId?: string;
  subject?: string;
  gradeLevel?: string;
  query?: string;
  parentId?: string | null;
}
