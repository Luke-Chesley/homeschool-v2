/**
 * Scoring and progress mapping model.
 *
 * Activities can contribute to progress in multiple ways beyond quiz percentage.
 * This module defines the scoring model (how evidence is interpreted) and the
 * progress signal (what gets reported to tracking).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Scoring model (declared in ActivitySpec)
// ---------------------------------------------------------------------------

export const ScoringModeSchema = z.enum([
  /** Answers are graded as correct/incorrect and averaged */
  "correctness_based",
  /** Progress is credited when the learner submits (no grading) */
  "completion_based",
  /** Teacher/parent scores against rubric criteria */
  "rubric_based",
  /** Teacher or supervisor directly confirms mastery */
  "teacher_observed",
  /** Learner's self-reported confidence drives progress signal */
  "confidence_report",
  /** Evidence is collected and stored; scoring happens later out-of-band */
  "evidence_collected",
]);
export type ScoringMode = z.infer<typeof ScoringModeSchema>;

export const ScoringModelSchema = z.object({
  mode: ScoringModeSchema,
  /** Fraction (0-1) needed to count as mastered (only for correctness_based) */
  masteryThreshold: z.number().min(0).max(1).default(0.8),
  /** Fraction below which to flag for review (correctness_based / rubric_based) */
  reviewThreshold: z.number().min(0).max(1).default(0.6),
  /** For rubric_based: minimum average level to count as mastered */
  rubricMasteryLevel: z.number().int().positive().optional(),
  /** For confidence_report: minimum confidence level (1-5) for mastery */
  confidenceMasteryLevel: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});
export type ScoringModel = z.infer<typeof ScoringModelSchema>;

// ---------------------------------------------------------------------------
// Progress signal (emitted after scoring)
// ---------------------------------------------------------------------------

export const ProgressStatusSchema = z.enum([
  "mastered",
  "progressing",
  "needs_review",
  "needs_reteach",
  "evidence_pending",
  "completed_no_score",
]);
export type ProgressStatus = z.infer<typeof ProgressStatusSchema>;

export const ProgressSignalSchema = z.object({
  status: ProgressStatusSchema,
  /** 0-100 when applicable */
  scorePercent: z.number().min(0).max(100).optional(),
  masteryLevel: z.enum(["not_started", "emerging", "developing", "secure", "mastered"]).optional(),
  confidenceLevel: z.number().int().min(1).max(5).optional(),
  requiresReview: z.boolean().default(false),
  reviewReason: z.string().optional(),
  linkedObjectiveIds: z.array(z.string()).default([]),
  linkedSkillIds: z.array(z.string()).default([]),
  completedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ProgressSignal = z.infer<typeof ProgressSignalSchema>;

// ---------------------------------------------------------------------------
// Score interpreter: given scoring model + raw outcome, produce ProgressSignal
// ---------------------------------------------------------------------------

export function interpretScore(params: {
  model: ScoringModel;
  scorePercent?: number;
  rubricAverage?: number;
  confidenceLevel?: number;
  evidenceCaptured?: boolean;
  completedAt: string;
  linkedObjectiveIds?: string[];
  linkedSkillIds?: string[];
}): ProgressSignal {
  const { model, completedAt } = params;
  const linkedObjectiveIds = params.linkedObjectiveIds ?? [];
  const linkedSkillIds = params.linkedSkillIds ?? [];

  switch (model.mode) {
    case "correctness_based": {
      const pct = params.scorePercent ?? 0;
      const mastery = model.masteryThreshold * 100;
      const review = model.reviewThreshold * 100;
      return {
        status: pct >= mastery ? "mastered" : pct >= review ? "progressing" : "needs_review",
        scorePercent: pct,
        masteryLevel: pct >= mastery ? "secure" : pct >= review ? "developing" : "emerging",
        requiresReview: pct < review,
        reviewReason: pct < review ? "Score below review threshold" : undefined,
        linkedObjectiveIds,
        linkedSkillIds,
        completedAt,
      };
    }

    case "completion_based": {
      return {
        status: "completed_no_score",
        scorePercent: 100,
        masteryLevel: "developing",
        requiresReview: false,
        linkedObjectiveIds,
        linkedSkillIds,
        completedAt,
      };
    }

    case "rubric_based": {
      const avg = params.rubricAverage;
      const minMastery = model.rubricMasteryLevel ?? 2;
      if (avg == null) {
        return {
          status: "evidence_pending",
          requiresReview: true,
          reviewReason: "Rubric scores not yet assigned",
          linkedObjectiveIds,
          linkedSkillIds,
          completedAt,
        };
      }
      return {
        status: avg >= minMastery ? "mastered" : "needs_review",
        requiresReview: avg < minMastery,
        reviewReason: avg < minMastery ? "Rubric score below mastery level" : undefined,
        linkedObjectiveIds,
        linkedSkillIds,
        completedAt,
      };
    }

    case "teacher_observed": {
      return {
        status: "evidence_pending",
        requiresReview: true,
        reviewReason: "Awaiting teacher observation",
        linkedObjectiveIds,
        linkedSkillIds,
        completedAt,
      };
    }

    case "confidence_report": {
      const conf = params.confidenceLevel ?? 0;
      const minConf = model.confidenceMasteryLevel ?? 4;
      return {
        status: conf >= minConf ? "progressing" : "needs_review",
        confidenceLevel: conf,
        requiresReview: conf < minConf,
        reviewReason: conf < minConf ? "Learner confidence below threshold" : undefined,
        linkedObjectiveIds,
        linkedSkillIds,
        completedAt,
      };
    }

    case "evidence_collected": {
      return {
        status: "evidence_pending",
        requiresReview: true,
        reviewReason: "Evidence collected — awaiting scoring",
        linkedObjectiveIds,
        linkedSkillIds,
        completedAt,
      };
    }

    default: {
      return {
        status: "completed_no_score",
        requiresReview: false,
        linkedObjectiveIds,
        linkedSkillIds,
        completedAt,
      };
    }
  }
}
