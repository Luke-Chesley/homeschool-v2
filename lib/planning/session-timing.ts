/**
 * Canonical timing contract for lesson/session duration.
 *
 * Precedence (high → low):
 *  1. Explicit lesson-level override — per-lesson minutes when intentionally set
 *  2. Curriculum source default — sessionMinutes from the source's pacing contract
 *  3. System fallback — only when no curriculum timing exists anywhere
 *
 * Do NOT scatter numeric defaults across planning and lesson-draft code.
 * All callers that need a session budget must go through resolveLessonSessionMinutes.
 *
 * Item-level effort (itemEffortMinutes) is separate from the session budget.
 * Summing route-item effort values does NOT produce a valid session budget.
 */

/** Single authoritative fallback when no curriculum timing is present at any level. */
export const LESSON_SESSION_FALLBACK_MINUTES = 45;

export type LessonTimingSource =
  | "lesson_override"   // explicit per-lesson or per-node override
  | "source_default"    // curriculum source pacing.sessionMinutes
  | "system_fallback";  // LESSON_SESSION_FALLBACK_MINUTES — no curriculum timing

export interface LessonTimingContract {
  /** The resolved session budget to use for this lesson/draft. */
  resolvedTotalMinutes: number;
  /** Curriculum-level default session minutes, if the source has pacing data. */
  sourceSessionMinutes: number | undefined;
  /** Explicit per-lesson override that takes precedence over the source default. */
  lessonOverrideMinutes: number | undefined;
  /** What determined the resolved value — use for UI labels and diagnostics. */
  timingSource: LessonTimingSource;
}

/**
 * Resolves the canonical session budget for a lesson draft or session record.
 *
 * Usage:
 *   const timing = resolveLessonSessionMinutes({
 *     sourceSessionMinutes: source.pacing?.sessionMinutes,
 *     lessonOverrideMinutes: node?.lessonOverrideMinutes,
 *   });
 *   // Use timing.resolvedTotalMinutes as the session budget.
 *   // Use timing.timingSource for UI labels ("30 min from curriculum pacing").
 */
export function resolveLessonSessionMinutes(opts: {
  sourceSessionMinutes: number | undefined;
  lessonOverrideMinutes?: number | undefined;
}): LessonTimingContract {
  if (opts.lessonOverrideMinutes != null) {
    return {
      resolvedTotalMinutes: opts.lessonOverrideMinutes,
      sourceSessionMinutes: opts.sourceSessionMinutes,
      lessonOverrideMinutes: opts.lessonOverrideMinutes,
      timingSource: "lesson_override",
    };
  }

  if (opts.sourceSessionMinutes != null) {
    return {
      resolvedTotalMinutes: opts.sourceSessionMinutes,
      sourceSessionMinutes: opts.sourceSessionMinutes,
      lessonOverrideMinutes: undefined,
      timingSource: "source_default",
    };
  }

  return {
    resolvedTotalMinutes: LESSON_SESSION_FALLBACK_MINUTES,
    sourceSessionMinutes: undefined,
    lessonOverrideMinutes: undefined,
    timingSource: "system_fallback",
  };
}

/**
 * Returns a human-readable label for the timing source.
 * Useful for surfaces that want to show timing provenance.
 */
export function formatTimingSourceLabel(contract: LessonTimingContract): string {
  switch (contract.timingSource) {
    case "lesson_override":
      return `${contract.resolvedTotalMinutes} min (lesson override)`;
    case "source_default":
      return `${contract.resolvedTotalMinutes} min from curriculum pacing`;
    case "system_fallback":
      return `${contract.resolvedTotalMinutes} min (default)`;
  }
}
