/**
 * Provider-agnostic AI adapter interface.
 *
 * All AI interactions go through this interface. Concrete implementations
 * are in adapters/. The router selects the appropriate adapter based on
 * model routing configuration.
 *
 * Design principles:
 * - Provider-agnostic: no provider-specific types leak into callers
 * - Streaming-first for chat; structured output for generation
 * - Long-running generation is modeled as job dispatch, not blocking calls
 */

import type { ZodType } from "zod";
import type { ChatMessage, AiTaskName } from "./types";

// ---------------------------------------------------------------------------
// Core completion interface
// ---------------------------------------------------------------------------

export interface CompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** System prompt override — if omitted, use the task's prompt template */
  systemPrompt?: string;
}

export interface StructuredCompletionOptions<T = unknown> extends CompletionOptions {
  outputSchema?: ZodType<T>;
}

export interface CompletionResult {
  content: string;
  /** Approximate token usage for billing/logging */
  usage?: { promptTokens: number; completionTokens: number };
  model?: string;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface AiProviderAdapter {
  readonly providerId: string;
  readonly displayName: string;

  /**
   * Non-streaming text completion.
   * Use for short structured outputs (standards suggestions, summaries).
   */
  complete(options: CompletionOptions): Promise<CompletionResult>;

  /**
   * Streaming completion — yields delta chunks.
   * Use for chat responses.
   */
  stream(options: CompletionOptions): AsyncIterable<StreamChunk>;

  /**
   * Attempt structured JSON output.
   * Returns parsed JSON or null if the model failed to comply.
   */
  completeJson<T>(options: StructuredCompletionOptions<T>): Promise<T | null>;
}

// ---------------------------------------------------------------------------
// Model routing configuration
// ---------------------------------------------------------------------------

export interface ModelRoutingConfig {
  /** Default model for each task name */
  taskDefaults: Partial<Record<AiTaskName, string>>;
  /** Fallback model when no task-specific default is set */
  fallbackModel: string;
  /** Provider to use */
  providerId: string;
}

export const DEFAULT_ROUTING_CONFIG: ModelRoutingConfig = {
  providerId: "mock",
  fallbackModel: "mock-model-1",
  taskDefaults: {
    "chat.answer": "mock-chat-model",
    "lesson.draft": "mock-generation-model",
    "worksheet.generate": "mock-generation-model",
    "interactive.generate": "mock-generation-model",
    "standards.suggest": "mock-fast-model",
    "text.summarize": "mock-fast-model",
    "plan.adapt": "mock-generation-model",
  },
};

export function getModelForTask(
  taskName: AiTaskName,
  config: ModelRoutingConfig = DEFAULT_ROUTING_CONFIG
): string {
  return config.taskDefaults[taskName] ?? config.fallbackModel;
}
