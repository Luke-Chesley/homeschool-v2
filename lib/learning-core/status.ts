import "@/lib/server-only";

import { getLearningCoreEnv } from "@/lib/env/server";

type LearningCoreRuntimePayload = {
  status: string;
  service: string;
  version: string;
  authRequired: boolean;
  operations: string[];
};

export type LearningCoreRuntimeStatus =
  | {
      available: true;
      checkedAt: string;
      baseUrl: string;
      runtime: LearningCoreRuntimePayload;
    }
  | {
      available: false;
      checkedAt: string;
      baseUrl: string | null;
      error: string;
    };

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export async function getLearningCoreRuntimeStatus(): Promise<LearningCoreRuntimeStatus> {
  const checkedAt = new Date().toISOString();

  try {
    const env = getLearningCoreEnv();
    const baseUrl = trimTrailingSlash(env.LEARNING_CORE_BASE_URL);
    const response = await fetch(`${baseUrl}/v1/runtime/status`, {
      method: "GET",
      headers: env.LEARNING_CORE_API_KEY
        ? {
            "X-Learning-Core-Key": env.LEARNING_CORE_API_KEY,
          }
        : undefined,
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as LearningCoreRuntimePayload | null;

    if (!response.ok || !payload) {
      return {
        available: false,
        checkedAt,
        baseUrl,
        error: `learning-core status request failed with status ${response.status}`,
      };
    }

    return {
      available: true,
      checkedAt,
      baseUrl,
      runtime: payload,
    };
  } catch (error) {
    return {
      available: false,
      checkedAt,
      baseUrl: process.env.LEARNING_CORE_BASE_URL?.trim() || null,
      error: error instanceof Error ? error.message : "learning-core status unavailable",
    };
  }
}
