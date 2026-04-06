// v1 legacy types (still used for existing activities in the DB)
export * from "./types";

// v2 canonical ActivitySpec
export * from "./spec";
export * from "./components";
export * from "./kinds";
// Explicit re-export resolves the ActivityKind name collision (./types has a legacy alias;
// ./kinds has the v2 canonical enum — the explicit export wins).
export type { ActivityKind } from "./kinds";
export * from "./evidence";
export * from "./scoring";
export * from "./validation";

// Services
export * from "./session-service";
export { getAttemptStore } from "./attempt-store";
export type { AttemptStore } from "./attempt-store";
export {
  generateActivitySpec,
  generateActivitySpecForLessonDraft,
} from "./generation-service";
export type { ActivityGenResult } from "./generation-service";
export {
  buildActivityContextFromLessonDraft,
  buildPromptInput,
  extractLessonDraftContext,
} from "./generation-context";
export type {
  ActivityGenerationContext,
  LessonContext,
  LessonDraftContext,
  CurriculumContext,
  ActivityScope,
  ActivityScopeKind,
} from "./generation-context";

// Fixtures (local dev only)
export { FIXTURE_SESSIONS } from "./fixtures";
