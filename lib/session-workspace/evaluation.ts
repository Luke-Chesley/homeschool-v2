export const LESSON_EVALUATION_LEVELS = [
  "needs_more_work",
  "partial",
  "successful",
  "exceeded",
] as const;

export type LessonEvaluationLevel = (typeof LESSON_EVALUATION_LEVELS)[number];

export interface LessonEvaluationOption {
  level: LessonEvaluationLevel;
  label: string;
  description: string;
}

export const LESSON_EVALUATION_OPTIONS: LessonEvaluationOption[] = [
  {
    level: "needs_more_work",
    label: "Needs more work",
    description: "The learner did not yet show the target skill or needed significant support.",
  },
  {
    level: "partial",
    label: "Partial",
    description: "The learner showed some understanding, but the task was not fully there yet.",
  },
  {
    level: "successful",
    label: "Completed successfully",
    description: "The learner completed the task at the expected level.",
  },
  {
    level: "exceeded",
    label: "Exceeded expectations",
    description: "The learner completed the task cleanly and showed extra independence or depth.",
  },
];

export function getLessonEvaluationLabel(level: LessonEvaluationLevel) {
  return LESSON_EVALUATION_OPTIONS.find((option) => option.level === level)?.label ?? level;
}

export function getLessonEvaluationRating(level: LessonEvaluationLevel) {
  switch (level) {
    case "needs_more_work":
      return 1;
    case "partial":
      return 2;
    case "successful":
      return 3;
    case "exceeded":
      return 4;
  }
}

export function getLessonEvaluationLevelFromRating(
  rating: number | null | undefined,
): LessonEvaluationLevel | null {
  switch (rating) {
    case 1:
      return "needs_more_work";
    case 2:
      return "partial";
    case 3:
      return "successful";
    case 4:
      return "exceeded";
    default:
      return null;
  }
}
