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

export const BoardSurfaceStateSchema = z.object({
  fen: z.string().min(1),
});
export type BoardSurfaceState = z.infer<typeof BoardSurfaceStateSchema>;

export const BoardSurfaceInteractionSchema = z.object({
  mode: z.enum(["view_only", "move_input"]).default("view_only"),
});
export type BoardSurfaceInteraction = z.infer<typeof BoardSurfaceInteractionSchema>;

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
  state: BoardSurfaceStateSchema,
  interaction: BoardSurfaceInteractionSchema,
  evaluation: ChessEvaluationSchema,
  annotations: BoardSurfaceAnnotationsSchema,
});
export type ChessBoardWidgetPayload = z.infer<typeof ChessBoardWidgetPayloadSchema>;

export const ExpressionSurfaceConfigSchema = z.object({
  placeholder: z.string().optional(),
  mathKeyboard: z.boolean().default(false),
});
export type ExpressionSurfaceConfig = z.infer<typeof ExpressionSurfaceConfigSchema>;

export const ExpressionSurfaceStateSchema = z.object({
  promptLatex: z.string().optional(),
  initialValue: z.string().optional(),
});
export type ExpressionSurfaceState = z.infer<typeof ExpressionSurfaceStateSchema>;

export const ExpressionSurfaceInteractionSchema = z.object({
  mode: z.enum(["expression_entry", "equation_entry", "step_entry"]).default("expression_entry"),
});
export type ExpressionSurfaceInteraction = z.infer<typeof ExpressionSurfaceInteractionSchema>;

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
  state: ExpressionSurfaceStateSchema,
  interaction: ExpressionSurfaceInteractionSchema,
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

export const GraphSurfaceStateSchema = z.object({
  prompt: z.string().optional(),
  initialExpression: z.string().optional(),
});
export type GraphSurfaceState = z.infer<typeof GraphSurfaceStateSchema>;

export const GraphSurfaceInteractionSchema = z.object({
  mode: z.enum(["plot_point", "plot_curve", "analyze_graph"]).default("plot_point"),
});
export type GraphSurfaceInteraction = z.infer<typeof GraphSurfaceInteractionSchema>;

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
  state: GraphSurfaceStateSchema,
  interaction: GraphSurfaceInteractionSchema,
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
