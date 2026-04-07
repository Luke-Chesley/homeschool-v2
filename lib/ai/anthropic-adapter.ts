import "@/lib/server-only";

import Anthropic from "@anthropic-ai/sdk";
import type {
  AiProviderAdapter,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  StructuredCompletionOptions,
} from "./provider-adapter";
import type { ChatMessage } from "./types";

const DEFAULT_MAX_TOKENS = 1024;

export interface AnthropicAdapterOptions {
  apiKey?: string;
  authToken?: string;
  baseURL?: string;
  providerId?: string;
  displayName?: string;
}

export class AnthropicAdapter implements AiProviderAdapter {
  readonly providerId: string;
  readonly displayName: string;

  private readonly client: Anthropic;

  constructor(options: AnthropicAdapterOptions) {
    this.providerId = options.providerId ?? "anthropic";
    this.displayName = options.displayName ?? "Anthropic";
    this.client = new Anthropic({
      apiKey: options.apiKey ?? undefined,
      authToken: options.authToken ?? undefined,
      baseURL: options.baseURL ?? undefined,
    });
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const request = this.buildRequest(options);
    const message = await this.client.messages.create(request);

    return {
      content: extractTextContent(message.content),
      usage: message.usage
        ? {
            promptTokens: message.usage.input_tokens,
            completionTokens: message.usage.output_tokens,
          }
        : undefined,
      model: message.model,
      debugMetadata: {
        rawPayload: message,
        stopReason: message.stop_reason ?? undefined,
        rawContentLength: message.content
          .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
          .reduce((acc, b) => acc + b.text.length, 0),
        blockCount: message.content.length,
        perBlockLengths: message.content
          .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
          .map((b) => b.text.length),
      },
    };
  }

  async *stream(options: CompletionOptions): AsyncIterable<StreamChunk> {
    const request = this.buildRequest(options);
    const stream = await this.client.messages.create({
      ...request,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { delta: event.delta.text, done: false };
      }
    }

    yield { delta: "", done: true };
  }

  async completeJson<T>(options: StructuredCompletionOptions<T>): Promise<T | null> {
    const response = await this.complete(options);
    const parsed = safeParseJson<T>(response.content);
    if (!parsed || !options.outputSchema) {
      return parsed;
    }

    const validated = options.outputSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  }

  private buildRequest(options: CompletionOptions) {
    const { system, messages } = normalizeMessages(options.messages, options.systemPrompt);

    return {
      model: options.model ?? "claude-sonnet-4-5",
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(system ? { system } : {}),
      messages,
    };
  }
}

function normalizeMessages(messages: ChatMessage[], systemPrompt?: string) {
  const systemParts = systemPrompt ? [systemPrompt] : [];
  const normalizedMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }

    normalizedMessages.push({
      role: message.role,
      content: message.content,
    });
  }

  return {
    system: systemParts.join("\n\n").trim() || undefined,
    messages: normalizedMessages,
  };
}

function extractTextContent(content: Anthropic.Message["content"]): string {
  const text = content
    .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text.trim();
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
