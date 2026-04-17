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

const LEARNING_CORE_STATUS_TIMEOUT_MS = 2_500;
const LEARNING_CORE_STATUS_SUCCESS_TTL_MS = 30_000;
const LEARNING_CORE_STATUS_ERROR_TTL_MS = 10_000;

let statusCache:
  | {
      expiresAt: number;
      value: LearningCoreRuntimeStatus;
    }
  | null = null;
let statusInFlight: Promise<LearningCoreRuntimeStatus> | null = null;

function createTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
    },
  };
}

async function fetchLearningCoreRuntimeStatus(): Promise<LearningCoreRuntimeStatus> {
  const checkedAt = new Date().toISOString();

  try {
    const env = getLearningCoreEnv();
    const baseUrl = trimTrailingSlash(env.LEARNING_CORE_BASE_URL);
    const timeout = createTimeoutController(LEARNING_CORE_STATUS_TIMEOUT_MS);
    const response = await fetch(`${baseUrl}/v1/runtime/status`, {
      method: "GET",
      headers: env.LEARNING_CORE_API_KEY
        ? {
            "X-Learning-Core-Key": env.LEARNING_CORE_API_KEY,
          }
        : undefined,
      cache: "no-store",
      signal: timeout.signal,
    }).finally(() => {
      timeout.dispose();
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
      error:
        error instanceof Error && error.name === "AbortError"
          ? "learning-core status request timed out"
          : error instanceof Error
            ? error.message
            : "learning-core status unavailable",
    };
  }
}

export async function getLearningCoreRuntimeStatus(): Promise<LearningCoreRuntimeStatus> {
  const now = Date.now();

  if (statusCache && statusCache.expiresAt > now) {
    return statusCache.value;
  }

  if (statusInFlight) {
    return statusInFlight;
  }

  statusInFlight = fetchLearningCoreRuntimeStatus()
    .then((value) => {
      statusCache = {
        value,
        expiresAt:
          Date.now() +
          (value.available
            ? LEARNING_CORE_STATUS_SUCCESS_TTL_MS
            : LEARNING_CORE_STATUS_ERROR_TTL_MS),
      };
      return value;
    })
    .finally(() => {
      statusInFlight = null;
    });

  return statusInFlight;
}
