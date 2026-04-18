/**
 * Canonical ActivitySpec — the single authoritative model for the new activity runtime.
 *
 * An ActivitySpec separates:
 *   - Content / learning intent (activityKind, purpose, linkedObjectiveIds)
 *   - Interaction (components[], interactionMode)
 *   - Completion rules (completionRules)
 *   - Evidence (evidenceSchema)
 *   - Scoring / progress (scoringModel)
 *
 * Activities are rendered deterministically from specs by the component registry.
 * No arbitrary UI code is generated or stored.
 *
 * schemaVersion "2" is the new canonical version.
 * schemaVersion "1" refers to the legacy per-kind blueprint format (read-only compat).
 */

import { z } from "zod";
import { ActivityKindSchema } from "./kinds.ts";
import { ComponentSpecSchema } from "./components.ts";
import { EvidenceSpecSchema } from "./evidence.ts";
import { ScoringModelSchema } from "./scoring.ts";

// ---------------------------------------------------------------------------
// Completion rules
// ---------------------------------------------------------------------------

export const CompletionRulesSchema = z.object({
  /**
   * Strategy for deciding when the activity is complete.
   * - "all_interactive_components" — every interactive component must be answered
   * - "minimum_components" — at least N interactive components answered
   * - "any_submission" — learner can submit at any point
   * - "teacher_approval" — teacher/parent must mark complete
   */
  strategy: z.enum([
    "all_interactive_components",
    "minimum_components",
    "any_submission",
    "teacher_approval",
  ]).default("all_interactive_components"),
  minimumComponents: z.number().int().positive().optional(),
  /** Message shown when learner tries to submit before completion criteria are met */
  incompleteMessage: z.string().optional(),
});
export type CompletionRules = z.infer<typeof CompletionRulesSchema>;

// ---------------------------------------------------------------------------
// Teacher support metadata
// ---------------------------------------------------------------------------

export const TeacherSupportSchema = z.object({
  /** Setup instructions for the teacher/parent before starting the activity */
  setupNotes: z.string().optional(),
  /** Discussion questions to use during or after the activity */
  discussionQuestions: z.array(z.string()).optional(),
  /** Indicators of mastery the teacher should watch for */
  masteryIndicators: z.array(z.string()).optional(),
  /** Common misconceptions or pitfalls */
  commonMistakes: z.string().optional(),
  /** Extension or enrichment suggestions */
  extensionIdeas: z.string().optional(),
});
export type TeacherSupport = z.infer<typeof TeacherSupportSchema>;

// ---------------------------------------------------------------------------
// Offline mode configuration
// ---------------------------------------------------------------------------

export const OfflineModeConfigSchema = z.object({
  /** Description of what the learner does offline */
  offlineTaskDescription: z.string(),
  /** What materials are needed */
  materials: z.array(z.string()).optional(),
  /** How evidence is captured when offline (free-text instruction) */
  evidenceCaptureInstruction: z.string().optional(),
});
export type OfflineModeConfig = z.infer<typeof OfflineModeConfigSchema>;

// ---------------------------------------------------------------------------
// Adaptation rules
// ---------------------------------------------------------------------------

export const AdaptationRulesSchema = z.object({
  /** Hint strategy: "on_request" shows hints only when asked; "always" shows inline */
  hintStrategy: z.enum(["on_request", "always", "after_wrong_attempt"]).default("on_request"),
  /** Allow learner to skip the activity and come back */
  allowSkip: z.boolean().default(false),
  /** Allow multiple submission attempts */
  allowRetry: z.boolean().default(false),
  /** Max retries (undefined = unlimited) */
  maxRetries: z.number().int().positive().optional(),
});
export type AdaptationRules = z.infer<typeof AdaptationRulesSchema>;

// ---------------------------------------------------------------------------
// Activity template hint (optional — shapes generation without forcing rigid templates)
// ---------------------------------------------------------------------------

export const ActivityTemplateHintSchema = z.enum([
  "exploratory",
  "practice_heavy",
  "demonstration_then_try",
  "evidence_capture",
  "reflection_first",
  "project_step",
]);
export type ActivityTemplateHint = z.infer<typeof ActivityTemplateHintSchema>;

// ---------------------------------------------------------------------------
// The canonical ActivitySpec
// ---------------------------------------------------------------------------

export const ActivitySpecSchema = z.object({
  /** Always "2" for new specs */
  schemaVersion: z.literal("2"),

  /** Unique ID — set after persistence; optional for in-memory/generation use */
  id: z.string().optional(),

  title: z.string().min(1),
  /** What the learner is doing and why — a plain-language statement of intent */
  purpose: z.string(),

  /** Learning intent taxonomy */
  activityKind: ActivityKindSchema,

  /** IDs of curriculum objectives or skill nodes this activity addresses */
  linkedObjectiveIds: z.array(z.string()).default([]),
  /** Free-text skill titles for generation context (not required to be DB IDs) */
  linkedSkillLabels: z.array(z.string()).default([]),

  estimatedMinutes: z.number().int().positive(),

  /**
   * "digital" — fully screen-based
   * "offline" — core interaction is offline; screen only captures evidence
   * "hybrid" — mix of both
   */
  interactionMode: z.enum(["digital", "offline", "hybrid"]),

  /** Ordered list of component specs to render */
  components: z.array(ComponentSpecSchema).min(1),

  completionRules: CompletionRulesSchema.default({ strategy: "all_interactive_components" }),
  evidenceSchema: EvidenceSpecSchema,
  scoringModel: ScoringModelSchema,

  adaptationRules: AdaptationRulesSchema.optional(),
  teacherSupport: TeacherSupportSchema.optional(),
  offlineMode: OfflineModeConfigSchema.optional(),

  /** Optional hint to the generation layer about overall activity shape */
  templateHint: ActivityTemplateHintSchema.optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ActivitySpec = z.infer<typeof ActivitySpecSchema>;

// ---------------------------------------------------------------------------
// Parse helper
// ---------------------------------------------------------------------------

/**
 * Parse an unknown value as an ActivitySpec (schemaVersion "2").
 * Returns null if the value does not match the schema.
 */
export function parseActivitySpec(value: unknown): ActivitySpec | null {
  const result = ActivitySpecSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Returns true if the value looks like a v2 ActivitySpec (schemaVersion === "2").
 * Use this as a fast pre-check before full parsing.
 */
export function isActivitySpec(value: unknown): value is ActivitySpec {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    (value as Record<string, unknown>).schemaVersion === "2"
  );
}
