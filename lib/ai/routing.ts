import "@/lib/server-only";

import { DEFAULT_ROUTING_CONFIG, type ModelRoutingConfig } from "./provider-adapter";

let cachedRoutingConfig: ModelRoutingConfig | undefined;

export function getAiRoutingConfig(): ModelRoutingConfig {
  if (!cachedRoutingConfig) {
    cachedRoutingConfig = DEFAULT_ROUTING_CONFIG;
  }

  return cachedRoutingConfig;
}
