/**
 * Provider-agnostic AI adapter interface.
 *
 * The app no longer owns provider SDKs or credentials. All real model access
 * goes through the external learning-core service. This file preserves the
 * task-service interface while routing metadata becomes boundary metadata.
 */

import type { ZodType } from "zod";
import type { ChatMessage, AiTaskName } from "./types";

export interface CompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface StructuredCompletionOptions<T = unknown> extends CompletionOptions {
  outputSchema?: ZodType<T>;
}

export interface CompletionResult {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
  model?: string;
  debugMetadata?: {
    rawPayload?: unknown;
    stopReason?: string;
    finishReason?: string;
    rawContentLength?: number;
    blockCount?: number;
    perBlockLengths?: number[];
  };
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export interface AiProviderAdapter {
  readonly providerId: string;
  readonly displayName: string;
  complete(options: CompletionOptions): Promise<CompletionResult>;
  stream(options: CompletionOptions): AsyncIterable<StreamChunk>;
  completeJson<T>(options: StructuredCompletionOptions<T>): Promise<T | null>;
}

export interface ModelRoutingConfig {
  taskDefaults: Partial<Record<AiTaskName, string>>;
  fallbackModel: string;
  providerId: string;
  maxTokens?: number;
}

export const DEFAULT_ROUTING_CONFIG: ModelRoutingConfig = {
  providerId: "learning-core",
  fallbackModel: "learning-core/default",
  taskDefaults: {
    "curriculum.intake": "learning-core/chat.answer",
    "curriculum.generate": "learning-core/curriculum.generate",
    "curriculum.generate.core": "learning-core/curriculum.generate.core",
    "curriculum.generate.progression": "learning-core/curriculum.generate.progression",
    "curriculum.revise": "learning-core/curriculum.revise",
    "curriculum.revise.core": "learning-core/curriculum.revise.core",
    "curriculum.revise.progression": "learning-core/curriculum.revise.progression",
    "curriculum.title": "learning-core/curriculum.title",
    "chat.answer": "learning-core/chat.answer",
    "lesson.draft": "learning-core/lesson.draft",
    "worksheet.generate": "learning-core/worksheet.generate",
    "interactive.generate": "learning-core/interactive.generate",
    "standards.suggest": "learning-core/standards.suggest",
    "text.summarize": "learning-core/text.summarize",
    "plan.adapt": "learning-core/plan.adapt",
  },
};

export function getAiRoutingConfig(): ModelRoutingConfig {
  return DEFAULT_ROUTING_CONFIG;
}

export function getModelForTask(
  taskName: AiTaskName,
  config: ModelRoutingConfig = DEFAULT_ROUTING_CONFIG,
): string {
  return config.taskDefaults[taskName] ?? config.fallbackModel;
}
