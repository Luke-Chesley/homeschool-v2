/**
 * AI platform domain types.
 *
 * The AI layer is task-oriented: every AI operation is modeled as a named
 * task with typed inputs/outputs. This prevents one giant prompt helper and
 * makes it easy to version prompts, route to different models, and audit
 * lineage.
 *
 * Provider-agnostic: concrete implementations live in adapters/, not here.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Provider / model identifiers
// ---------------------------------------------------------------------------

export const ModelIdSchema = z.string().min(1);
export type ModelId = z.infer<typeof ModelIdSchema>;

export const ProviderIdSchema = z.enum([
  "anthropic",
  "openai",
  "google",
  "mock",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

// ---------------------------------------------------------------------------
// Task registry
// ---------------------------------------------------------------------------

/**
 * All supported AI task names.
 *
 * Each task has its own input/output schema (see task-schemas.ts).
 * Long-running tasks are executed via Inngest jobs; short tasks can run
 * inline in route handlers.
 */
export const AiTaskNameSchema = z.enum([
  "lesson.draft",           // Generate a lesson outline from topic + standard
  "worksheet.generate",    // Generate a printable worksheet
  "interactive.generate",  // Generate an activity schema (quiz, flashcards, etc.)
  "plan.adapt",            // Suggest plan adjustments based on outcomes
  "text.summarize",        // Summarize source material
  "standards.suggest",     // Suggest standards for an objective text
  "chat.answer",           // Conversational answer in the copilot
]);
export type AiTaskName = z.infer<typeof AiTaskNameSchema>;

export const AiRunModeSchema = z.enum([
  "inline",  // Blocking HTTP — short tasks only
  "async",   // Inngest job — long-running generation
]);
export type AiRunMode = z.infer<typeof AiRunModeSchema>;

// ---------------------------------------------------------------------------
// Prompt reference
// ---------------------------------------------------------------------------

/**
 * Points to a stored prompt template.
 * Version is a semver-like string, e.g. "1.0.0".
 */
export const PromptRefSchema = z.object({
  task: AiTaskNameSchema,
  version: z.string().default("1.0.0"),
});
export type PromptRef = z.infer<typeof PromptRefSchema>;

// ---------------------------------------------------------------------------
// Message shapes (chat)
// ---------------------------------------------------------------------------

export const ChatRoleSchema = z.enum(["user", "assistant", "system"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string(),
  /** ISO timestamp */
  createdAt: z.string().datetime().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ---------------------------------------------------------------------------
// Artifact lineage
// ---------------------------------------------------------------------------

/**
 * Records what AI inputs produced a given artifact so parents can audit,
 * regenerate, or adjust outputs.
 */
export const ArtifactLineageSchema = z.object({
  id: z.string().uuid(),
  taskName: AiTaskNameSchema,
  promptRef: PromptRefSchema,
  providerId: ProviderIdSchema,
  modelId: ModelIdSchema,
  inputHash: z.string(), // SHA-256 of serialized inputs
  createdAt: z.string().datetime(),
  /** ID of the artifact produced (lesson, worksheet, activity, etc.) */
  artifactId: z.string().optional(),
  artifactKind: z.string().optional(),
});
export type ArtifactLineage = z.infer<typeof ArtifactLineageSchema>;

// ---------------------------------------------------------------------------
// Copilot action shapes (structured, durable)
// ---------------------------------------------------------------------------

/**
 * A copilot action is a structured operation that the AI can trigger.
 * Unlike chat messages, actions are persisted and can modify the system.
 *
 * These are separate from the chat stream so the UI can render them
 * distinctly and the system can apply them idempotently.
 */

export const CopilotActionKindSchema = z.enum([
  "plan.add_lesson",       // Add a lesson to a planning slot
  "plan.adjust_schedule",  // Suggest a schedule change
  "artifact.create",       // Create a durable artifact (lesson, worksheet, etc.)
  "recommendation.create", // Store a curriculum recommendation
  "standards.map",         // Map standards to an objective
]);
export type CopilotActionKind = z.infer<typeof CopilotActionKindSchema>;

export const CopilotActionSchema = z.object({
  id: z.string().uuid(),
  kind: CopilotActionKindSchema,
  /** Human-readable description */
  label: z.string(),
  /** Structured payload — shape depends on kind */
  payload: z.record(z.string(), z.unknown()),
  /** Whether the parent has applied/dismissed this action */
  status: z.enum(["pending", "applied", "dismissed"]).default("pending"),
  createdAt: z.string().datetime(),
  lineageId: z.string().uuid().optional(),
});
export type CopilotAction = z.infer<typeof CopilotActionSchema>;

// ---------------------------------------------------------------------------
// Copilot context (passed to AI to ground its responses)
// ---------------------------------------------------------------------------

export const CopilotContextSchema = z.object({
  /** Current learner being discussed */
  learnerId: z.string().optional(),
  learnerName: z.string().optional(),
  /** Current curriculum source */
  curriculumSourceId: z.string().optional(),
  /** Current lesson/unit being discussed */
  lessonId: z.string().optional(),
  /** Standards in scope */
  standardIds: z.array(z.string()).default([]),
  /** Custom goals in scope */
  goalIds: z.array(z.string()).default([]),
  /** Recent outcomes for context */
  recentOutcomes: z.array(
    z.object({ title: z.string(), status: z.string(), date: z.string() })
  ).default([]),
});
export type CopilotContext = z.infer<typeof CopilotContextSchema>;

// ---------------------------------------------------------------------------
// Generation job payload (for Inngest)
// ---------------------------------------------------------------------------

export const GenerationJobSchema = z.object({
  jobId: z.string().uuid(),
  taskName: AiTaskNameSchema,
  inputs: z.unknown(),
  context: CopilotContextSchema.optional(),
  promptRef: PromptRefSchema,
  providerId: ProviderIdSchema.optional(),
  requestedAt: z.string().datetime(),
  /** Where to store the result once complete */
  outputTarget: z.enum(["lesson", "worksheet", "activity", "recommendation", "draft"]).optional(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
