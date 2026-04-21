export interface LessonSlotAssignmentLike {
  scheduledSlotIndex?: number | null;
  manualOverrideNote?: string | null;
}

const EXPLICIT_SEPARATE_LESSON_NOTE_PREFIXES = [
  "Pulled forward into lesson ",
  "Repeated from ",
  "Swapped in for ",
  "Scheduled directly for ",
] as const;

export function hasExplicitSeparateLessonSlotNote(
  manualOverrideNote?: string | null,
) {
  if (!manualOverrideNote) {
    return false;
  }

  return EXPLICIT_SEPARATE_LESSON_NOTE_PREFIXES.some((prefix) =>
    manualOverrideNote.startsWith(prefix),
  );
}

export function resolveEffectiveScheduledSlotIndex(
  item: LessonSlotAssignmentLike,
) {
  const rawSlotIndex = item.scheduledSlotIndex;
  if (rawSlotIndex == null) {
    return null;
  }

  const normalizedSlotIndex = rawSlotIndex > 0 ? rawSlotIndex : 1;
  if (normalizedSlotIndex <= 1) {
    return 1;
  }

  return hasExplicitSeparateLessonSlotNote(item.manualOverrideNote)
    ? normalizedSlotIndex
    : 1;
}
