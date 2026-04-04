import "server-only";

/**
 * AI adapter registry.
 *
 * Maps provider IDs to adapter instances. This is the single integration
 * point for adding new AI providers.
 *
 * Integration point: register real adapters (AnthropicAdapter, OllamaAdapter,
 * OpenAIAdapter) here when credentials or local endpoints are provisioned.
 * The interface is stable.
 */

import { AnthropicAdapter } from "./anthropic-adapter";
import { OllamaAdapter } from "./ollama-adapter";
import type { AiProviderAdapter } from "./provider-adapter";
import { getMockAdapter } from "./mock-adapter";
import { getAiRoutingConfig } from "./routing";
import type { AiTaskName } from "./types";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const adapters = new Map<string, AiProviderAdapter>();
let anthropicAdapter: AnthropicAdapter | null = null;
let ollamaAdapter: OllamaAdapter | null = null;

function registerAdapter(adapter: AiProviderAdapter) {
  adapters.set(adapter.providerId, adapter);
}

// Register built-in adapters
registerAdapter(getMockAdapter());

function registerConfiguredAdapters() {
  const routing = getAiRoutingConfig();

  if (routing.providerId === "anthropic" && !adapters.has("anthropic")) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (apiKey) {
      const adapter = (anthropicAdapter ??= new AnthropicAdapter({ apiKey }));
      registerAdapter(adapter);
    }
  }

  if (routing.providerId === "ollama" && !adapters.has("ollama")) {
    const baseURL = process.env.OLLAMA_BASE_URL?.trim() ?? "http://localhost:11434";
    const authToken = process.env.OLLAMA_AUTH_TOKEN?.trim() || undefined;
    const numCtx = parseOptionalPositiveInteger(process.env.OLLAMA_NUM_CTX);
    const keepAlive = parseOptionalKeepAlive(process.env.OLLAMA_KEEP_ALIVE);
    const adapter = (ollamaAdapter ??= new OllamaAdapter({
      baseURL,
      authToken,
      numCtx,
      keepAlive,
    }));
    registerAdapter(adapter);
  }
}

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

export function getAdapter(providerId?: string): AiProviderAdapter {
  registerConfiguredAdapters();

  const id = providerId ?? getAiRoutingConfig().providerId;
  const adapter = adapters.get(id);
  if (!adapter) {
    console.warn(`[ai/registry] Provider "${id}" not registered, falling back to mock.`);
    return getMockAdapter();
  }
  return adapter;
}

export function getAdapterForTask(taskName: AiTaskName): AiProviderAdapter {
  const routing = getAiRoutingConfig();
  return getAdapter(routing.providerId);
}

export function listRegisteredProviders(): string[] {
  registerConfiguredAdapters();
  return [...adapters.keys()];
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseOptionalKeepAlive(value: string | undefined): string | number | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && `${parsed}` === trimmed ? parsed : trimmed;
}
