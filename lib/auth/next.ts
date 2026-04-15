const INTERNAL_BASE = "https://homeschool-v2.local";

export const AUTH_NEXT_COOKIE = "hsv2_next";

export function sanitizeNextPath(next: string | null | undefined, fallback = "/") {
  if (!next) {
    return fallback;
  }

  try {
    const url = new URL(next, INTERNAL_BASE);

    if (url.origin !== INTERNAL_BASE || !url.pathname.startsWith("/")) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildPathWithNext(path: string, next: string | null | undefined) {
  const safeNext = sanitizeNextPath(next, "");
  if (!safeNext) {
    return path;
  }

  const url = new URL(path, INTERNAL_BASE);
  url.searchParams.set("next", safeNext);
  return `${url.pathname}${url.search}${url.hash}`;
}
