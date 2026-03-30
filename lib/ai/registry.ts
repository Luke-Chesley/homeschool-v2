/**
 * AI adapter registry.
 *
 * Maps provider IDs to adapter instances. This is the single integration
 * point for adding new AI providers.
 *
 * Integration point: register real adapters (AnthropicAdapter, OpenAIAdapter)
 * here when API keys are provisioned. The interface is stable.
 */

import type { AiProviderAdapter } from "./provider-adapter";
import { getMockAdapter } from "./mock-adapter";
import { DEFAULT_ROUTING_CONFIG } from "./provider-adapter";
import type { AiTaskName } from "./types";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const adapters = new Map<string, AiProviderAdapter>();

function registerAdapter(adapter: AiProviderAdapter) {
  adapters.set(adapter.providerId, adapter);
}

// Register built-in adapters
registerAdapter(getMockAdapter());

// Integration points — uncomment and implement when providers are ready:
// registerAdapter(new AnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY }));
// registerAdapter(new OpenAIAdapter({ apiKey: env.OPENAI_API_KEY }));
// registerAdapter(new GoogleAdapter({ apiKey: env.GOOGLE_AI_API_KEY }));

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

export function getAdapter(providerId?: string): AiProviderAdapter {
  const id = providerId ?? DEFAULT_ROUTING_CONFIG.providerId;
  const adapter = adapters.get(id);
  if (!adapter) {
    console.warn(`[ai/registry] Provider "${id}" not registered, falling back to mock.`);
    return getMockAdapter();
  }
  return adapter;
}

export function getAdapterForTask(taskName: AiTaskName): AiProviderAdapter {
  return getAdapter(DEFAULT_ROUTING_CONFIG.providerId);
}

export function listRegisteredProviders(): string[] {
  return [...adapters.keys()];
}
