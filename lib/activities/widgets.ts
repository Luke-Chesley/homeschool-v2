import { z } from "zod";

const ChessSquareSchema = z.string().regex(/^[a-h][1-8]$/);

export const WidgetSurfaceKindSchema = z.enum([
  "board_surface",
  "expression_surface",
  "graph_surface",
]);
export type WidgetSurfaceKind = z.infer<typeof WidgetSurfaceKindSchema>;

export const WidgetEngineKindSchema = z.enum([
  "chess",
  "math_symbolic",
  "graphing",
]);
export type WidgetEngineKind = z.infer<typeof WidgetEngineKindSchema>;

export const WidgetSurfaceRoleSchema = z.enum(["primary", "supporting"]);
export type WidgetSurfaceRole = z.infer<typeof WidgetSurfaceRoleSchema>;

export const WidgetSubmissionModeSchema = z.enum(["immediate", "explicit_submit"]);
export type WidgetSubmissionMode = z.infer<typeof WidgetSubmissionModeSchema>;

export const WidgetSelectionModeSchema = z.enum(["click_click", "drag_drop", "either"]);
export type WidgetSelectionMode = z.infer<typeof WidgetSelectionModeSchema>;

export const WidgetFeedbackModeSchema = z.enum(["none", "immediate", "explicit_submit"]);
export type WidgetFeedbackMode = z.infer<typeof WidgetFeedbackModeSchema>;

export const WidgetFeedbackDisplayModeSchema = z.enum(["inline", "banner"]);
export type WidgetFeedbackDisplayMode = z.infer<typeof WidgetFeedbackDisplayModeSchema>;

export const WidgetResetPolicySchema = z.enum(["not_allowed", "reset_to_initial"]);
export type WidgetResetPolicy = z.infer<typeof WidgetResetPolicySchema>;

export const WidgetAttemptPolicySchema = z.enum(["single_attempt", "allow_retry"]);
export type WidgetAttemptPolicy = z.infer<typeof WidgetAttemptPolicySchema>;

export const WidgetArrowSchema = z.object({
  fromSquare: ChessSquareSchema,
  toSquare: ChessSquareSchema,
  color: z.enum(["green", "blue", "yellow", "red"]).default("green"),
});
export type WidgetArrow = z.infer<typeof WidgetArrowSchema>;

export const BoardSurfaceConfigSchema = z.object({
  orientation: z.enum(["white", "black"]).default("white"),
});
export type BoardSurfaceConfig = z.infer<typeof BoardSurfaceConfigSchema>;

export const BoardSurfaceDisplaySchema = z.object({
  showSideToMove: z.boolean().default(true),
  showCoordinates: z.boolean().default(true),
  showMoveHint: z.boolean().default(true),
  boardRole: WidgetSurfaceRoleSchema.default("primary"),
});
export type BoardSurfaceDisplay = z.infer<typeof BoardSurfaceDisplaySchema>;

export const BoardSurfaceStateSchema = z.object({
  fen: z.string().min(1),
});
export type BoardSurfaceState = z.infer<typeof BoardSurfaceStateSchema>;

export const BoardSurfaceInteractionSchema = z.object({
  mode: z.enum(["view_only", "move_input"]).default("view_only"),
  submissionMode: WidgetSubmissionModeSchema.default("immediate"),
  selectionMode: WidgetSelectionModeSchema.default("either"),
  showLegalTargets: z.boolean().default(true),
  allowReset: z.boolean().default(true),
  resetPolicy: WidgetResetPolicySchema.default("reset_to_initial"),
  attemptPolicy: WidgetAttemptPolicySchema.default("allow_retry"),
});
export type BoardSurfaceInteraction = z.infer<typeof BoardSurfaceInteractionSchema>;

export const BoardSurfaceFeedbackSchema = z.object({
  mode: WidgetFeedbackModeSchema.default("immediate"),
  displayMode: WidgetFeedbackDisplayModeSchema.default("inline"),
});
export type BoardSurfaceFeedback = z.infer<typeof BoardSurfaceFeedbackSchema>;

export const ChessEvaluationSchema = z.object({
  expectedMoves: z.array(z.string()).default([]),
});
export type ChessEvaluation = z.infer<typeof ChessEvaluationSchema>;

export const BoardSurfaceAnnotationsSchema = z.object({
  highlightSquares: z.array(ChessSquareSchema).default([]),
  arrows: z.array(WidgetArrowSchema).default([]),
});
export type BoardSurfaceAnnotations = z.infer<typeof BoardSurfaceAnnotationsSchema>;

export const ChessBoardWidgetPayloadSchema = z.object({
  surfaceKind: z.literal("board_surface"),
  engineKind: z.literal("chess"),
  version: z.literal("1"),
  surface: BoardSurfaceConfigSchema,
  display: BoardSurfaceDisplaySchema.default({}),
  state: BoardSurfaceStateSchema,
  interaction: BoardSurfaceInteractionSchema,
  feedback: BoardSurfaceFeedbackSchema.default({}),
  evaluation: ChessEvaluationSchema,
  annotations: BoardSurfaceAnnotationsSchema,
});
export type ChessBoardWidgetPayload = z.infer<typeof ChessBoardWidgetPayloadSchema>;

export const ExpressionSurfaceConfigSchema = z.object({
  placeholder: z.string().optional(),
  mathKeyboard: z.boolean().default(false),
});
export type ExpressionSurfaceConfig = z.infer<typeof ExpressionSurfaceConfigSchema>;

export const ExpressionSurfaceDisplaySchema = z.object({
  surfaceRole: WidgetSurfaceRoleSchema.default("primary"),
});
export type ExpressionSurfaceDisplay = z.infer<typeof ExpressionSurfaceDisplaySchema>;

export const ExpressionSurfaceStateSchema = z.object({
  promptLatex: z.string().optional(),
  initialValue: z.string().optional(),
});
export type ExpressionSurfaceState = z.infer<typeof ExpressionSurfaceStateSchema>;

export const ExpressionSurfaceInteractionSchema = z.object({
  mode: z.enum(["expression_entry", "equation_entry", "step_entry"]).default("expression_entry"),
  submissionMode: WidgetSubmissionModeSchema.default("explicit_submit"),
  resetPolicy: WidgetResetPolicySchema.default("reset_to_initial"),
  attemptPolicy: WidgetAttemptPolicySchema.default("allow_retry"),
});
export type ExpressionSurfaceInteraction = z.infer<typeof ExpressionSurfaceInteractionSchema>;

export const ExpressionSurfaceFeedbackSchema = z.object({
  mode: WidgetFeedbackModeSchema.default("explicit_submit"),
  displayMode: WidgetFeedbackDisplayModeSchema.default("inline"),
});
export type ExpressionSurfaceFeedback = z.infer<typeof ExpressionSurfaceFeedbackSchema>;

export const MathSymbolicEvaluationSchema = z.object({
  expectedExpression: z.string().optional(),
  equivalenceMode: z.enum(["exact", "simplified", "equivalent"]).default("equivalent"),
});
export type MathSymbolicEvaluation = z.infer<typeof MathSymbolicEvaluationSchema>;

export const ExpressionSurfaceAnnotationsSchema = z.object({
  helperText: z.string().optional(),
});
export type ExpressionSurfaceAnnotations = z.infer<typeof ExpressionSurfaceAnnotationsSchema>;

export const MathSymbolicWidgetPayloadSchema = z.object({
  surfaceKind: z.literal("expression_surface"),
  engineKind: z.literal("math_symbolic"),
  version: z.literal("1"),
  surface: ExpressionSurfaceConfigSchema,
  display: ExpressionSurfaceDisplaySchema.default({}),
  state: ExpressionSurfaceStateSchema,
  interaction: ExpressionSurfaceInteractionSchema,
  feedback: ExpressionSurfaceFeedbackSchema.default({}),
  evaluation: MathSymbolicEvaluationSchema,
  annotations: ExpressionSurfaceAnnotationsSchema,
});
export type MathSymbolicWidgetPayload = z.infer<typeof MathSymbolicWidgetPayloadSchema>;

export const GraphSurfaceConfigSchema = z.object({
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  grid: z.boolean().default(true),
});
export type GraphSurfaceConfig = z.infer<typeof GraphSurfaceConfigSchema>;

export const GraphSurfaceDisplaySchema = z.object({
  surfaceRole: WidgetSurfaceRoleSchema.default("primary"),
});
export type GraphSurfaceDisplay = z.infer<typeof GraphSurfaceDisplaySchema>;

export const GraphSurfaceStateSchema = z.object({
  prompt: z.string().optional(),
  initialExpression: z.string().optional(),
});
export type GraphSurfaceState = z.infer<typeof GraphSurfaceStateSchema>;

export const GraphSurfaceInteractionSchema = z.object({
  mode: z.enum(["plot_point", "plot_curve", "analyze_graph"]).default("plot_point"),
  submissionMode: WidgetSubmissionModeSchema.default("explicit_submit"),
  resetPolicy: WidgetResetPolicySchema.default("reset_to_initial"),
  attemptPolicy: WidgetAttemptPolicySchema.default("allow_retry"),
});
export type GraphSurfaceInteraction = z.infer<typeof GraphSurfaceInteractionSchema>;

export const GraphSurfaceFeedbackSchema = z.object({
  mode: WidgetFeedbackModeSchema.default("explicit_submit"),
  displayMode: WidgetFeedbackDisplayModeSchema.default("inline"),
});
export type GraphSurfaceFeedback = z.infer<typeof GraphSurfaceFeedbackSchema>;

export const GraphingEvaluationSchema = z.object({
  expectedGraphDescription: z.string().optional(),
});
export type GraphingEvaluation = z.infer<typeof GraphingEvaluationSchema>;

export const GraphSurfaceAnnotationsSchema = z.object({
  overlayText: z.string().optional(),
});
export type GraphSurfaceAnnotations = z.infer<typeof GraphSurfaceAnnotationsSchema>;

export const GraphingWidgetPayloadSchema = z.object({
  surfaceKind: z.literal("graph_surface"),
  engineKind: z.literal("graphing"),
  version: z.literal("1"),
  surface: GraphSurfaceConfigSchema,
  display: GraphSurfaceDisplaySchema.default({}),
  state: GraphSurfaceStateSchema,
  interaction: GraphSurfaceInteractionSchema,
  feedback: GraphSurfaceFeedbackSchema.default({}),
  evaluation: GraphingEvaluationSchema,
  annotations: GraphSurfaceAnnotationsSchema,
});
export type GraphingWidgetPayload = z.infer<typeof GraphingWidgetPayloadSchema>;

export const InteractiveWidgetPayloadSchema = z.discriminatedUnion("engineKind", [
  ChessBoardWidgetPayloadSchema,
  MathSymbolicWidgetPayloadSchema,
  GraphingWidgetPayloadSchema,
]);
export type InteractiveWidgetPayload = z.infer<typeof InteractiveWidgetPayloadSchema>;

export const BoardSurfaceMoveSchema = z.object({
  from: ChessSquareSchema,
  to: ChessSquareSchema,
  san: z.string().optional(),
  uci: z.string().optional(),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
  fenAfter: z.string().optional(),
});
export type BoardSurfaceMove = z.infer<typeof BoardSurfaceMoveSchema>;

export const InteractiveWidgetComponentSchema = z.object({
  type: z.literal("interactive_widget"),
  id: z.string(),
  prompt: z.string(),
  required: z.boolean().default(true),
  widget: InteractiveWidgetPayloadSchema,
});
export type InteractiveWidgetComponent = z.infer<typeof InteractiveWidgetComponentSchema>;

export function widgetAcceptsInput(widget: InteractiveWidgetPayload) {
  if (widget.engineKind === "chess") {
    return widget.interaction.mode === "move_input";
  }
  return true;
}
