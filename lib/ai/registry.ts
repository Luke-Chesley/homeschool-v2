import "@/lib/server-only";

import { getLearningCoreGatewayAdapter } from "./learning-core-adapter";
import type { AiProviderAdapter } from "./provider-adapter";
import type { AiTaskName } from "./types";

export function getAdapter(_providerId?: string): AiProviderAdapter {
  return getLearningCoreGatewayAdapter();
}

export function getAdapterForTask(_taskName: AiTaskName): AiProviderAdapter {
  return getLearningCoreGatewayAdapter();
}

export function listRegisteredProviders(): string[] {
  return [getLearningCoreGatewayAdapter().providerId];
}
