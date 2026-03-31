import "server-only";

/**
 * AI adapter registry.
 *
 * Maps provider IDs to adapter instances. This is the single integration
 * point for adding new AI providers.
 *
 * Integration point: register real adapters (AnthropicAdapter, OpenAIAdapter)
 * here when API keys are provisioned. The interface is stable.
 */

import { AnthropicAdapter } from "./anthropic-adapter";
import type { AiProviderAdapter } from "./provider-adapter";
import { getMockAdapter } from "./mock-adapter";
import { getAiRoutingConfig } from "./routing";
import type { AiTaskName } from "./types";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const adapters = new Map<string, AiProviderAdapter>();
let anthropicAdapter: AnthropicAdapter | null = null;

function registerAdapter(adapter: AiProviderAdapter) {
  adapters.set(adapter.providerId, adapter);
}

// Register built-in adapters
registerAdapter(getMockAdapter());

function registerConfiguredAdapters() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey || adapters.has("anthropic")) {
    return;
  }

  anthropicAdapter ??= new AnthropicAdapter({ apiKey });
  registerAdapter(anthropicAdapter);
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
