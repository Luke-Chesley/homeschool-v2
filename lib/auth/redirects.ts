import { getClientEnv } from "@/lib/env/client";
import { sanitizeNextPath } from "@/lib/auth/next";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLocalOrigin(origin: string) {
  return origin.includes("localhost") || origin.includes("127.0.0.1");
}

export function getAuthRedirectBaseUrl() {
  const env = getClientEnv();

  if (typeof window === "undefined") {
    return trimTrailingSlash(env.NEXT_PUBLIC_SITE_URL);
  }

  const origin = trimTrailingSlash(window.location.origin);

  if (env.APP_ENV === "local") {
    return origin;
  }

  if (!isLocalOrigin(origin)) {
    return origin;
  }

  return trimTrailingSlash(env.NEXT_PUBLIC_SITE_URL);
}

export function getAuthConfirmRedirectUrl(nextPath?: string | null) {
  const url = new URL("/auth/confirm", getAuthRedirectBaseUrl());
  const safeNext = sanitizeNextPath(nextPath, "");

  if (safeNext) {
    url.searchParams.set("next", safeNext);
  }

  return url.toString();
}
