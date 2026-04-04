import "server-only";

import { AnthropicAdapter, type AnthropicAdapterOptions } from "./anthropic-adapter";

export interface OllamaAdapterOptions
  extends Omit<AnthropicAdapterOptions, "providerId" | "displayName"> {}

export class OllamaAdapter extends AnthropicAdapter {
  constructor(options: OllamaAdapterOptions) {
    super({
      ...options,
      providerId: "ollama",
      displayName: "Ollama",
    });
  }
}
