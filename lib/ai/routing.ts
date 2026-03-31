import "server-only";

import { z } from "zod";

import { DEFAULT_ROUTING_CONFIG, type ModelRoutingConfig } from "./provider-adapter";

const aiRoutingEnvSchema = z.object({
  AI_PROVIDER: z.enum(["mock", "anthropic", "openai", "google"]).optional(),
  AI_CHAT_MODEL: z.string().min(1).optional(),
  AI_FAST_MODEL: z.string().min(1).optional(),
  AI_GENERATION_MODEL: z.string().min(1).optional(),
  AI_FALLBACK_MODEL: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

let cachedRoutingConfig: ModelRoutingConfig | undefined;

export function getAiRoutingConfig(): ModelRoutingConfig {
  if (cachedRoutingConfig) {
    return cachedRoutingConfig;
  }

  const env = aiRoutingEnvSchema.parse(process.env);

  const providerId =
    env.AI_PROVIDER ??
    (env.ANTHROPIC_API_KEY ? "anthropic" : DEFAULT_ROUTING_CONFIG.providerId);

  cachedRoutingConfig = {
    providerId,
    fallbackModel:
      env.AI_FALLBACK_MODEL ??
      (providerId === "anthropic"
        ? "claude-sonnet-4-0"
        : DEFAULT_ROUTING_CONFIG.fallbackModel),
    taskDefaults: {
      ...DEFAULT_ROUTING_CONFIG.taskDefaults,
      ...(providerId === "anthropic"
        ? {
            "chat.answer": env.AI_CHAT_MODEL ?? "claude-sonnet-4-0",
            "lesson.draft": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-0",
            "worksheet.generate": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-0",
            "interactive.generate": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-0",
            "plan.adapt": env.AI_GENERATION_MODEL ?? "claude-sonnet-4-0",
            "standards.suggest": env.AI_FAST_MODEL ?? "claude-3-5-haiku-latest",
            "text.summarize": env.AI_FAST_MODEL ?? "claude-3-5-haiku-latest",
          }
        : {}),
    },
  };

  return cachedRoutingConfig;
}
