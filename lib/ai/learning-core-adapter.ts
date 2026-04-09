import "@/lib/server-only";

import type {
  AiProviderAdapter,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  StructuredCompletionOptions,
} from "./provider-adapter";

import { getLearningCoreEnv } from "@/lib/env/server";
import { postLearningCore } from "@/lib/learning-core/client";

const GATEWAY_PROVIDER_ID = "learning-core";

type GatewayCompleteResponse = {
  content: string;
  provider_id: string;
  model_id: string;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
  parsed?: unknown;
};

export class LearningCoreGatewayAdapter implements AiProviderAdapter {
  readonly providerId = GATEWAY_PROVIDER_ID;
  readonly displayName = "learning-core gateway";

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const response = await postLearningCore<GatewayCompleteResponse>("/v1/gateway/complete", {
      task_name: normalizeTaskName(options.model),
      model: options.model,
      system_prompt: options.systemPrompt,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      messages: options.messages,
    });

    return {
      content: response.content,
      model: response.model_id,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens ?? 0,
            completionTokens: response.usage.completion_tokens ?? 0,
          }
        : undefined,
      debugMetadata: {
        rawPayload: response,
        finishReason: "gateway_complete",
      },
    };
  }

  async *stream(options: CompletionOptions): AsyncIterable<StreamChunk> {
    try {
      const response = await fetchStreamingGateway("/v1/gateway/stream", {
        task_name: normalizeTaskName(options.model),
        model: options.model,
        system_prompt: options.systemPrompt,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        messages: options.messages,
      });

      for await (const chunk of iterateNdjson<{ delta?: string; done?: boolean }>(response)) {
        yield {
          delta: typeof chunk.delta === "string" ? chunk.delta : "",
          done: Boolean(chunk.done),
        };
      }
    } catch (streamError) {
      const fallback = await this.complete(options).catch((completeError) => {
        if (completeError instanceof Error) {
          throw completeError;
        }
        if (streamError instanceof Error) {
          throw streamError;
        }
        throw new Error("learning-core streaming request failed.");
      });

      if (fallback.content) {
        yield {
          delta: fallback.content,
          done: false,
        };
      }

      yield {
        delta: "",
        done: true,
      };
    }
  }

  async completeJson<T>(options: StructuredCompletionOptions<T>): Promise<T | null> {
    const response = await postLearningCore<GatewayCompleteResponse>("/v1/gateway/complete-json", {
      task_name: normalizeTaskName(options.model),
      model: options.model,
      system_prompt: options.systemPrompt,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      messages: options.messages,
    });

    const candidate = response.parsed ?? safeParseJson(response.content);
    if (!candidate) {
      return null;
    }
    if (!options.outputSchema) {
      return candidate as T;
    }
    const validated = options.outputSchema.safeParse(candidate);
    return validated.success ? validated.data : null;
  }
}

let singleton: LearningCoreGatewayAdapter | null = null;

export function getLearningCoreGatewayAdapter() {
  if (!singleton) {
    singleton = new LearningCoreGatewayAdapter();
  }

  return singleton;
}

function normalizeTaskName(model: string | undefined) {
  if (!model) {
    return "unknown";
  }
  if (model.startsWith("learning-core/")) {
    return model.slice("learning-core/".length);
  }
  return model;
}

function safeParseJson<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (!fenceMatch) {
      return null;
    }
    try {
      return JSON.parse(fenceMatch[1]) as T;
    } catch {
      return null;
    }
  }
}

async function fetchStreamingGateway(path: string, body: unknown) {
  const env = getLearningCoreEnv();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (env.LEARNING_CORE_API_KEY?.trim()) {
    headers["X-Learning-Core-Key"] = env.LEARNING_CORE_API_KEY.trim();
  }

  const response = await fetch(`${env.LEARNING_CORE_BASE_URL!.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    const payload = (await response.text().catch(() => "")).trim();
    throw new Error(payload || `learning-core streaming request failed with status ${response.status}`);
  }

  return response.body;
}

async function* iterateNdjson<T>(body: ReadableStream<Uint8Array>): AsyncIterable<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }
      if (done) {
        break;
      }

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          yield JSON.parse(line) as T;
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    const trailing = buffer.trim();
    if (trailing) {
      yield JSON.parse(trailing) as T;
    }
  } finally {
    reader.releaseLock();
  }
}
