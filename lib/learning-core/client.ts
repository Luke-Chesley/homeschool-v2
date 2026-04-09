import "@/lib/server-only";

import { getServerEnv } from "@/lib/env/server";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getLearningCoreBaseUrl() {
  const env = getServerEnv();
  const baseUrl = env.LEARNING_CORE_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("LEARNING_CORE_BASE_URL is required for learning-core operations.");
  }

  return trimTrailingSlash(baseUrl);
}

function getLearningCoreHeaders() {
  const env = getServerEnv();
  const apiKey = env.LEARNING_CORE_API_KEY?.trim();

  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-Learning-Core-Key": apiKey } : {}),
  };
}

export async function postLearningCore<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getLearningCoreBaseUrl()}${path}`, {
    method: "POST",
    headers: getLearningCoreHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `learning-core request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

