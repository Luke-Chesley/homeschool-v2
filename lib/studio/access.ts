import "@/lib/server-only";

import type { StudioAccess } from "@/lib/studio/types";

const disabledStudioAccess: StudioAccess = {
  enabled: false,
  isLocal: false,
  isOperator: false,
  canViewPrompts: false,
  canViewArtifacts: false,
  canViewRuntimeEvents: false,
};

export function getStudioAccess(): StudioAccess {
  const isLocal = process.env.APP_ENV === "local";

  if (!isLocal) {
    return disabledStudioAccess;
  }

  return {
    enabled: true,
    isLocal: true,
    isOperator: true,
    canViewPrompts: true,
    canViewArtifacts: true,
    canViewRuntimeEvents: true,
  };
}

export function canViewPromptPreviews() {
  return getStudioAccess().canViewPrompts;
}

export function canViewRawArtifacts() {
  return getStudioAccess().canViewArtifacts;
}
