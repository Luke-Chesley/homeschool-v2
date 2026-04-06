/**
 * Structured evidence model for the activity runtime.
 *
 * Evidence is captured separately from the activity definition and attempt.
 * Each interaction event produces one or more evidence records that are stored
 * in a normalized, queryable form and linked back to the learner, activity,
 * lesson session, and linked objectives.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Interaction event types
// ---------------------------------------------------------------------------

export const InteractionEventKindSchema = z.enum([
  "component_started",
  "component_completed",
  "answer_submitted",
  "reorder_finished",
  "reflection_entered",
  "file_uploaded",
  "image_captured",
  "audio_captured",
  "teacher_checkoff_recorded",
  "rubric_level_selected",
  "confidence_changed",
  "observation_recorded",
  "checkoff_completed",
  "hotspot_selected",
  "pairs_matched",
  "items_categorized",
  "choice_made",
  "steps_completed",
  "construction_submitted",
]);
export type InteractionEventKind = z.infer<typeof InteractionEventKindSchema>;

export const InteractionEventSchema = z.object({
  id: z.string(),
  kind: InteractionEventKindSchema,
  activityId: z.string(),
  attemptId: z.string(),
  componentId: z.string(),
  componentType: z.string(),
  learnerId: z.string(),
  lessonSessionId: z.string().optional(),
  /** The raw captured value from this interaction */
  payload: z.unknown(),
  occurredAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type InteractionEvent = z.infer<typeof InteractionEventSchema>;

// ---------------------------------------------------------------------------
// Evidence record (persisted, normalized)
// ---------------------------------------------------------------------------

export const EvidenceKindSchema = z.enum([
  "answer_response",
  "file_artifact",
  "image_artifact",
  "audio_artifact",
  "self_assessment",
  "teacher_observation",
  "teacher_checkoff",
  "completion_marker",
  "confidence_signal",
  "reflection_response",
  "rubric_score",
  "ordering_result",
  "matching_result",
  "categorization_result",
  "construction_product",
]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceRecordSchema = z.object({
  id: z.string(),
  kind: EvidenceKindSchema,
  activityId: z.string(),
  attemptId: z.string(),
  componentId: z.string(),
  componentType: z.string(),
  learnerId: z.string(),
  lessonSessionId: z.string().optional(),
  linkedObjectiveIds: z.array(z.string()).default([]),
  linkedSkillIds: z.array(z.string()).default([]),
  /** Normalized value for querying */
  value: z.unknown(),
  /** Human-readable summary */
  summary: z.string().optional(),
  capturedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

// ---------------------------------------------------------------------------
// Evidence schema (part of ActivitySpec — declares what evidence an activity produces)
// ---------------------------------------------------------------------------

export const EvidenceSpecSchema = z.object({
  /** What kinds of evidence this activity will capture */
  captureKinds: z.array(EvidenceKindSchema).min(1),
  /** Whether evidence requires teacher review before contributing to progress */
  requiresReview: z.boolean().default(false),
  /** Whether evidence can be auto-scored */
  autoScorable: z.boolean().default(false),
  /** Instructions for a reviewer/grader */
  reviewerNotes: z.string().optional(),
});
export type EvidenceSpec = z.infer<typeof EvidenceSpecSchema>;
