import { z } from "zod";

import { ActivityComponentFeedbackSchema } from "./feedback";
import { BoardSurfaceMoveSchema, InteractiveWidgetPayloadSchema } from "./widgets";

const ChessSquareSchema = z.string().regex(/^[a-h][1-8]$/);

export const ChessMoveInputSchema = z.object({
  fromSquare: ChessSquareSchema.optional(),
  toSquare: ChessSquareSchema.optional(),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
  san: z.string().optional(),
  uci: z.string().optional(),
});
export type ChessMoveInput = z.infer<typeof ChessMoveInputSchema>;

export const BoardSelectSquareActionSchema = z.object({
  type: z.literal("select_square"),
  square: ChessSquareSchema,
});
export type BoardSelectSquareAction = z.infer<typeof BoardSelectSquareActionSchema>;

export const BoardSubmitMoveActionSchema = z.object({
  type: z.literal("submit_move"),
  move: z.union([ChessMoveInputSchema, z.string(), z.record(z.string(), z.unknown())]),
});
export type BoardSubmitMoveAction = z.infer<typeof BoardSubmitMoveActionSchema>;

export const BoardResetActionSchema = z.object({
  type: z.literal("reset"),
});
export type BoardResetAction = z.infer<typeof BoardResetActionSchema>;

export const WidgetLearnerActionSchema = z.discriminatedUnion("type", [
  BoardSelectSquareActionSchema,
  BoardSubmitMoveActionSchema,
  BoardResetActionSchema,
]);
export type WidgetLearnerAction = z.infer<typeof WidgetLearnerActionSchema>;

export const WidgetTransitionArtifactSchema = z.object({
  schemaVersion: z.literal("1"),
  componentId: z.string(),
  componentType: z.string(),
  widgetEngineKind: z.string().optional(),
  accepted: z.boolean(),
  normalizedLearnerAction: z.unknown().optional(),
  nextResponse: z.unknown().optional(),
  canonicalWidget: InteractiveWidgetPayloadSchema,
  legalTargets: z.array(ChessSquareSchema).default([]),
  immediateFeedback: ActivityComponentFeedbackSchema.optional(),
  errorMessage: z.string().optional(),
});
export type WidgetTransitionArtifact = z.infer<typeof WidgetTransitionArtifactSchema>;

export const RequestActivityComponentTransitionSchema = z.object({
  componentId: z.string().min(1),
  componentType: z.string().min(1),
  widget: InteractiveWidgetPayloadSchema,
  learnerAction: WidgetLearnerActionSchema,
  currentResponse: z.unknown().optional(),
  timeSpentMs: z.number().int().nonnegative().optional(),
});
export type RequestActivityComponentTransition = z.infer<typeof RequestActivityComponentTransitionSchema>;

export function readBoardMove(value: unknown) {
  const parsed = BoardSurfaceMoveSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
