import { getClientEnv } from "@/lib/env/client";

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

export function getAuthConfirmRedirectUrl() {
  return `${getAuthRedirectBaseUrl()}/auth/confirm`;
}
