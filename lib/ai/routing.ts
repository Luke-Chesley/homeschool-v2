import "@/lib/server-only";

import { z } from "zod";

import { DEFAULT_ROUTING_CONFIG, type ModelRoutingConfig } from "./provider-adapter";
import type { AiTaskName } from "./types";

const aiRoutingEnvSchema = z.object({
  AI_PROVIDER: z.enum(["mock", "anthropic", "openai", "google", "ollama"]).optional(),
  AI_CHAT_MODEL: z.string().min(1).optional(),
  AI_FAST_MODEL: z.string().min(1).optional(),
  AI_GENERATION_MODEL: z.string().min(1).optional(),
  AI_FALLBACK_MODEL: z.string().min(1).optional(),
  AI_MAX_TOKENS: z.coerce.number().int().positive().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_AUTH_TOKEN: z.string().min(1).optional(),
});

let cachedRoutingConfig: ModelRoutingConfig | undefined;

const OLLAMA_DEFAULT_MODEL = "llama3.2";

export function getAiRoutingConfig(): ModelRoutingConfig {
  if (cachedRoutingConfig) {
    return cachedRoutingConfig;
  }

  const env = aiRoutingEnvSchema.parse(process.env);

  const providerId =
    env.AI_PROVIDER ??
    (env.OLLAMA_BASE_URL
      ? "ollama"
      : env.ANTHROPIC_API_KEY
        ? "anthropic"
        : DEFAULT_ROUTING_CONFIG.providerId);

  const anthropicDefaults: Partial<Record<AiTaskName, string>> = {
    "curriculum.intake": env.AI_CHAT_MODEL ?? "claude-sonnet-4-5",
    "curriculum.generate": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "curriculum.generate.core": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "curriculum.generate.progression": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "curriculum.revise": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "curriculum.revise.core": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "curriculum.revise.progression": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "curriculum.title": env.AI_FAST_MODEL ?? "claude-haiku-4-5",
    "chat.answer": env.AI_CHAT_MODEL ?? "claude-sonnet-4-5",
    "lesson.draft": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "worksheet.generate": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "interactive.generate": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "plan.adapt": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-5",
    "standards.suggest": env.AI_FAST_MODEL ?? "claude-haiku-4-5",
    "text.summarize": env.AI_FAST_MODEL ?? "claude-haiku-4-5",
  };

  const ollamaSeedModel =
    env.AI_CHAT_MODEL ??
    env.AI_GENERATION_MODEL ??
    env.AI_FAST_MODEL ??
    env.AI_FALLBACK_MODEL ??
    OLLAMA_DEFAULT_MODEL;
  const ollamaDefaults: Partial<Record<AiTaskName, string>> = {
    "curriculum.intake": env.AI_CHAT_MODEL ?? ollamaSeedModel,
    "curriculum.generate": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "curriculum.generate.core": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "curriculum.generate.progression": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "curriculum.revise": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "curriculum.revise.core": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "curriculum.revise.progression": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "curriculum.title": env.AI_FAST_MODEL ?? ollamaSeedModel,
    "chat.answer": env.AI_CHAT_MODEL ?? ollamaSeedModel,
    "lesson.draft": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "worksheet.generate": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "interactive.generate": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "plan.adapt": env.AI_GENERATION_MODEL ?? ollamaSeedModel,
    "standards.suggest": env.AI_FAST_MODEL ?? ollamaSeedModel,
    "text.summarize": env.AI_FAST_MODEL ?? ollamaSeedModel,
  };

  cachedRoutingConfig = {
    providerId,
    maxTokens: env.AI_MAX_TOKENS,
    fallbackModel:
      env.AI_FALLBACK_MODEL ??
      (providerId === "anthropic"
        ? "claude-sonnet-4-5"
        : providerId === "ollama"
          ? ollamaSeedModel
          : DEFAULT_ROUTING_CONFIG.fallbackModel),
    taskDefaults: {
      ...DEFAULT_ROUTING_CONFIG.taskDefaults,
      ...(providerId === "anthropic"
        ? anthropicDefaults
        : providerId === "ollama"
          ? ollamaDefaults
          : {}),
    },
  };

  return cachedRoutingConfig;
}
