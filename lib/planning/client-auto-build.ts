"use client";

function getSessionStorageKey(prefix: string, buildKey: string) {
  return `${prefix}:${buildKey}`;
}

export function acquireAutoBuildLock(prefix: string, buildKey: string) {
  if (typeof window === "undefined") {
    return true;
  }

  const storageKey = getSessionStorageKey(prefix, buildKey);
  if (window.sessionStorage.getItem(storageKey)) {
    return false;
  }

  window.sessionStorage.setItem(storageKey, "1");
  return true;
}

export function releaseAutoBuildLock(prefix: string, buildKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getSessionStorageKey(prefix, buildKey));
}
