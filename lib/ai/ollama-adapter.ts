import "@/lib/server-only";

import type {
  AiProviderAdapter,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  StructuredCompletionOptions,
} from "./provider-adapter";
import type { ChatMessage } from "./types";

const DEFAULT_MODEL = "llama3.2";
const JSON_ONLY_INSTRUCTION =
  "Return only valid JSON. Do not include markdown fences, commentary, or surrounding prose.";

export interface OllamaAdapterOptions {
  baseURL?: string;
  authToken?: string;
  numCtx?: number;
  keepAlive?: string | number;
  providerId?: string;
  displayName?: string;
}

type OllamaChatMessage = Pick<ChatMessage, "role" | "content">;

type OllamaChatRequest = {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  options?: Record<string, unknown>;
  format?: "json";
  keep_alive?: string | number;
};

type OllamaChatResponse = {
  model?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  response?: string;
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

export class OllamaAdapter implements AiProviderAdapter {
  readonly providerId: string;
  readonly displayName: string;

  private readonly baseURL: string;
  private readonly authToken?: string;
  private readonly numCtx?: number;
  private readonly keepAlive?: string | number;

  constructor(options: OllamaAdapterOptions) {
    this.providerId = options.providerId ?? "ollama";
    this.displayName = options.displayName ?? "Ollama";
    this.baseURL = (options.baseURL ?? "http://localhost:11434").trim();
    this.authToken = options.authToken?.trim() || undefined;
    this.numCtx = normalizePositiveInteger(options.numCtx);
    this.keepAlive = normalizeKeepAlive(options.keepAlive);
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const response = await this.postChat(options, { stream: false });
    const payload = (await response.json()) as OllamaChatResponse;

    return {
      content: extractAssistantText(payload),
      usage: buildUsage(payload),
      model: payload.model,
    };
  }

  async *stream(options: CompletionOptions): AsyncIterable<StreamChunk> {
    const response = await this.postChat(options, { stream: true });

    if (!response.body) {
      throw new Error("[ollama-adapter] Missing response body for streaming chat completion");
    }

    for await (const chunk of this.iterateNdjson<OllamaChatResponse>(response.body)) {
      if (typeof chunk.error === "string" && chunk.error.trim()) {
        throw new Error(`[ollama-adapter] ${chunk.error.trim()}`);
      }

      const delta = extractDelta(chunk);
      if (delta) {
        yield { delta, done: false };
      }
    }

    yield { delta: "", done: true };
  }

  async completeJson<T>(options: StructuredCompletionOptions<T>): Promise<T | null> {
    const response = await this.postChat(options, {
      stream: false,
      jsonMode: true,
    });
    const payload = (await response.json()) as OllamaChatResponse;
    const parsed = safeParseJson<T>(extractAssistantText(payload));

    if (!parsed) {
      return null;
    }

    if (!options.outputSchema) {
      return parsed;
    }

    const validated = options.outputSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  }

  private async postChat(
    options: CompletionOptions,
    requestOptions: { stream: boolean; jsonMode?: boolean }
  ): Promise<Response> {
    const request = this.buildChatRequest(options, requestOptions);
    const response = await fetch(new URL("/api/chat", this.baseURL), {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    return response;
  }

  private buildChatRequest(
    options: CompletionOptions,
    requestOptions: { stream: boolean; jsonMode?: boolean }
  ): OllamaChatRequest {
    const messages = normalizeMessages(options.messages, options.systemPrompt, requestOptions.jsonMode);
    const request: OllamaChatRequest = {
      model: options.model ?? DEFAULT_MODEL,
      messages,
      stream: requestOptions.stream,
    };

    const runtimeOptions: Record<string, unknown> = {};
    if (options.temperature !== undefined) {
      runtimeOptions.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      runtimeOptions.num_predict = options.maxTokens;
    }
    if (this.numCtx !== undefined) {
      runtimeOptions.num_ctx = this.numCtx;
    }
    if (Object.keys(runtimeOptions).length > 0) {
      request.options = runtimeOptions;
    }
    if (this.keepAlive !== undefined) {
      request.keep_alive = this.keepAlive;
    }
    if (requestOptions.jsonMode) {
      request.format = "json";
    }

    return request;
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private async readError(response: Response): Promise<string> {
    const body = await response.text();
    const trimmed = body.trim();

    if (!trimmed) {
      return `[ollama-adapter] Request failed (${response.status} ${response.statusText})`;
    }

    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown; message?: unknown };
      const detail =
        typeof parsed.error === "string"
          ? parsed.error
          : typeof parsed.message === "string"
            ? parsed.message
            : trimmed;
      return `[ollama-adapter] Request failed (${response.status} ${response.statusText}): ${detail}`;
    } catch {
      return `[ollama-adapter] Request failed (${response.status} ${response.statusText}): ${trimmed}`;
    }
  }

  private async *iterateNdjson<T>(body: ReadableStream<Uint8Array>): AsyncIterable<T> {
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
            yield parseNdjsonLine<T>(line);
          }

          newlineIndex = buffer.indexOf("\n");
        }
      }

      buffer += decoder.decode();
      const trailing = buffer.trim();
      if (trailing) {
        yield parseNdjsonLine<T>(trailing);
      }
    } finally {
      reader.releaseLock();
    }
  }
}

function normalizeMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
  jsonMode?: boolean
): OllamaChatMessage[] {
  const normalized: OllamaChatMessage[] = [];

  if (jsonMode) {
    normalized.push({ role: "system", content: JSON_ONLY_INSTRUCTION });
  }

  if (systemPrompt?.trim()) {
    normalized.push({ role: "system", content: systemPrompt.trim() });
  }

  for (const message of messages) {
    normalized.push({
      role: message.role,
      content: message.content,
    });
  }

  return normalized;
}

function extractAssistantText(response: OllamaChatResponse): string {
  const content = response.message?.content ?? response.response ?? "";
  return content.trim();
}

function extractDelta(response: OllamaChatResponse): string {
  const content = response.message?.content ?? response.response ?? "";
  return content.length > 0 ? content : "";
}

function buildUsage(response: OllamaChatResponse): CompletionResult["usage"] {
  if (
    typeof response.prompt_eval_count !== "number" ||
    typeof response.eval_count !== "number"
  ) {
    return undefined;
  }

  return {
    promptTokens: response.prompt_eval_count,
    completionTokens: response.eval_count,
  };
}

function safeParseJson<T>(content: string): T | null {
  const candidates = buildJsonCandidates(content);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      continue;
    }
  }

  return null;
}

function buildJsonCandidates(content: string): string[] {
  const trimmed = content.trim();
  const candidates = new Set<string>();

  if (trimmed) {
    candidates.add(trimmed);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    candidates.add(fenced[1].trim());
  }

  const objectStart = content.indexOf("{");
  const objectEnd = content.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.add(content.slice(objectStart, objectEnd + 1).trim());
  }

  const arrayStart = content.indexOf("[");
  const arrayEnd = content.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.add(content.slice(arrayStart, arrayEnd + 1).trim());
  }

  return [...candidates].filter(Boolean);
}

function parseNdjsonLine<T>(line: string): T {
  try {
    return JSON.parse(line) as T;
  } catch {
    throw new Error(
      `[ollama-adapter] Failed to parse NDJSON line: ${line.slice(0, 200)}${
        line.length > 200 ? "…" : ""
      }`
    );
  }
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizeKeepAlive(value: string | number | undefined): string | number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
