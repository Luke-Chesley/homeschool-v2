"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import type { ActivityComponentFeedback } from "@/lib/activities/feedback";
import { Button } from "@/components/ui/button";
import {
  type BoardSurfaceMove,
  BoardSurfaceMoveSchema,
  ChessBoardWidgetPayloadSchema,
  type ChessBoardWidgetPayload,
  type InteractiveWidgetComponent,
  widgetAllowsReset,
  widgetCaption,
  widgetInstructionText,
} from "@/lib/activities/widgets";
import { cn } from "@/lib/utils";
import type { ComponentRendererProps } from "../types";
import { useSurfaceDrag } from "./use-surface-drag";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS_WHITE = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
const RANKS_BLACK = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

const PIECE_SYMBOLS: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

type ParsedPiece = {
  color: "w" | "b";
  type: "p" | "n" | "b" | "r" | "q" | "k";
};

function readMoveFromValue(value: unknown): BoardSurfaceMove | null {
  const parsed = BoardSurfaceMoveSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function readCanonicalWidgetFromValue(value: unknown): ChessBoardWidgetPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const parsed = ChessBoardWidgetPayloadSchema.safeParse(
    (value as { canonicalWidget?: unknown }).canonicalWidget,
  );
  return parsed.success ? parsed.data : null;
}

function readFen(value: unknown, fallbackFen: string | undefined) {
  const canonicalWidget = readCanonicalWidgetFromValue(value);
  if (canonicalWidget) {
    return canonicalWidget.state.fen;
  }

  const parsedMove = readMoveFromValue(value);
  if (parsedMove?.fenAfter) {
    return parsedMove.fenAfter;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.fen === "string" && record.fen.trim()) {
      return record.fen;
    }
  }

  return fallbackFen ?? "8/8/8/8/8/8/8/8 w - - 0 1";
}

function readOrientation(spec: InteractiveWidgetComponent) {
  if (spec.widget.engineKind === "chess") {
    return spec.widget.surface.orientation;
  }
  return "white" as const;
}

function parseFenPosition(fen: string) {
  const [boardPart, sideToMovePart] = fen.trim().split(/\s+/);
  if (!boardPart) {
    return null;
  }

  const rows = boardPart.split("/");
  if (rows.length !== 8) {
    return null;
  }

  const pieces = new Map<string, ParsedPiece>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    let fileIndex = 0;

    for (const char of row) {
      if (/\d/.test(char)) {
        fileIndex += Number(char);
        continue;
      }

      const file = FILES[fileIndex];
      const rank = String(8 - rowIndex);
      if (!file) {
        return null;
      }

      const color = char === char.toUpperCase() ? "w" : "b";
      const type = char.toLowerCase() as ParsedPiece["type"];
      pieces.set(`${file}${rank}`, { color, type });
      fileIndex += 1;
    }

    if (fileIndex !== 8) {
      return null;
    }
  }

  return {
    pieces,
    sideToMove: sideToMovePart === "b" ? "black" : "white",
  };
}

function squareCenterPercent(square: string, orientation: "white" | "black") {
  const files = orientation === "black" ? [...FILES].reverse() : [...FILES];
  const ranks = orientation === "black" ? [...RANKS_BLACK] : [...RANKS_WHITE];
  const fileIndex = files.indexOf(square[0] as (typeof FILES)[number]);
  const rankIndex = ranks.indexOf(square[1] as (typeof RANKS_WHITE)[number]);
  return {
    x: (fileIndex + 0.5) * 12.5,
    y: (rankIndex + 0.5) * 12.5,
  };
}

function arrowColor(color: string) {
  switch (color) {
    case "blue":
      return "rgb(59 130 246 / 0.72)";
    case "yellow":
      return "rgb(234 179 8 / 0.78)";
    case "red":
      return "rgb(239 68 68 / 0.8)";
    default:
      return "rgb(34 197 94 / 0.78)";
  }
}

function buildMoveHint(widget: ChessBoardWidgetPayload) {
  if (widget.interaction.mode !== "move_input" || !widget.display.showMoveHint) {
    return null;
  }

  if (widget.interaction.submissionMode === "explicit_submit") {
    return "Choose a piece and destination, or drag the piece, then submit the move.";
  }

  return "Choose a piece and destination, or drag the piece to its destination.";
}

function buildPersistedResponseValue(response: unknown, canonicalWidget: ChessBoardWidgetPayload) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return response;
  }

  return {
    ...(response as Record<string, unknown>),
    canonicalWidget,
  };
}

export function BoardSurface({
  spec,
  value,
  onChange,
  onRequestFeedback,
  onRequestTransition,
  feedback,
  disabled,
}: ComponentRendererProps<InteractiveWidgetComponent>) {
  if (spec.widget.engineKind !== "chess") {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Board surface is currently implemented for chess widgets only.
      </div>
    );
  }

  const markerId = React.useId();
  const orientation = readOrientation(spec);
  const initialWidget: ChessBoardWidgetPayload = spec.widget;

  const [runtimeWidget, setRuntimeWidget] = React.useState<ChessBoardWidgetPayload>(initialWidget);
  const [selectedSquare, setSelectedSquare] = React.useState<string | null>(null);
  const [legalTargets, setLegalTargets] = React.useState<string[]>([]);
  const [draftMove, setDraftMove] = React.useState<{ from: string; to: string } | null>(null);
  const [pendingTransition, setPendingTransition] = React.useState(false);
  const [transitionError, setTransitionError] = React.useState<string | null>(null);
  const [transitionFeedback, setTransitionFeedback] = React.useState<ActivityComponentFeedback | null>(null);

  React.useEffect(() => {
    setRuntimeWidget(initialWidget);
  }, [initialWidget]);

  React.useEffect(() => {
    setSelectedSquare(null);
    setLegalTargets([]);
    setDraftMove(null);
    setTransitionError(null);
    setTransitionFeedback(null);
  }, [spec.id]);

  React.useEffect(() => {
    const canonicalWidget = readCanonicalWidgetFromValue(value);
    if (!canonicalWidget) {
      return;
    }
    setRuntimeWidget(canonicalWidget);
  }, [value]);

  const renderFen = readFen(value, runtimeWidget.state.fen);
  const widgetForRequest: ChessBoardWidgetPayload = {
    ...runtimeWidget,
    state: {
      ...runtimeWidget.state,
      fen: renderFen,
    },
  };
  const parsedPosition = parseFenPosition(renderFen);

  if (!parsedPosition) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Board state is invalid and cannot be rendered.
      </div>
    );
  }

  const activeFeedback = transitionFeedback ?? feedback ?? null;
  const boardLocked = disabled || pendingTransition || activeFeedback?.allowRetry === false;
  const allowInput = widgetForRequest.interaction.mode === "move_input";
  const allowReset = widgetAllowsReset(widgetForRequest);
  const files = orientation === "black" ? [...FILES].reverse() : [...FILES];
  const ranks = orientation === "black" ? [...RANKS_BLACK] : [...RANKS_WHITE];
  const inlineFeedback = widgetForRequest.feedback.displayMode === "inline" ? activeFeedback : null;
  const sideToMoveLabel = parsedPosition.sideToMove === "white" ? "White to move" : "Black to move";
  const instructionText = widgetInstructionText(widgetForRequest);
  const caption = widgetCaption(widgetForRequest);
  const moveHint = buildMoveHint(widgetForRequest);
  const annotations = widgetForRequest.annotations ?? { arrows: [], highlightSquares: [] };
  const dragEnabled =
    allowInput &&
    !boardLocked;

  const surfaceDrag = useSurfaceDrag(
    {
      onDragEnd: (sourceId, targetId) => {
        if (!targetId || sourceId === targetId) {
          return;
        }
        if (widgetForRequest.interaction.submissionMode === "explicit_submit") {
          stageExplicitMove(sourceId, targetId);
          return;
        }
        void submitMove(sourceId, targetId);
      },
    },
    { disabled: !dragEnabled },
  );

  async function requestTransition(
    learnerAction:
      | { type: "select_square"; square: string }
      | { type: "submit_move"; move: Record<string, unknown> }
      | { type: "reset" },
  ) {
    if (!onRequestTransition) {
      return null;
    }

    setPendingTransition(true);
    setTransitionError(null);
    try {
      return await onRequestTransition(
        spec.id,
        spec.type,
        widgetForRequest,
        learnerAction,
        value,
      );
    } finally {
      setPendingTransition(false);
    }
  }

  async function handleSquareSelection(square: string) {
    if (!allowInput || boardLocked) {
      return;
    }

    const transition = await requestTransition({ type: "select_square", square });
    if (!transition) {
      return;
    }

    if (!transition.accepted) {
      setSelectedSquare(null);
      setLegalTargets([]);
      setTransitionError(transition.errorMessage ?? "That square cannot be selected right now.");
      return;
    }

    setSelectedSquare(square);
    setDraftMove(null);
    setLegalTargets(widgetForRequest.interaction.showLegalTargets ? transition.legalTargets : []);
    setTransitionError(null);
    setTransitionFeedback(null);
  }

  async function submitMove(from: string, to: string) {
    const transition = await requestTransition({
      type: "submit_move",
      move: {
        fromSquare: from,
        toSquare: to,
      },
    });

    if (!transition) {
      return;
    }

    if (!transition.accepted) {
      setTransitionError(transition.errorMessage ?? "That move was not accepted.");
      setSelectedSquare(from);
      setLegalTargets(widgetForRequest.interaction.showLegalTargets ? transition.legalTargets : []);
      return;
    }

    const nextWidget = transition.canonicalWidget as ChessBoardWidgetPayload;
    setRuntimeWidget(nextWidget);
    setSelectedSquare(null);
    surfaceDrag.cancel();
    setLegalTargets([]);
    setDraftMove(null);
    setTransitionError(null);
    setTransitionFeedback(transition.immediateFeedback ?? null);

    const shouldClearValue = transition.immediateFeedback?.allowRetry === true && transition.nextResponse == null;
    const nextValue = shouldClearValue
      ? null
      : buildPersistedResponseValue(
          transition.nextResponse ?? transition.normalizedLearnerAction ?? null,
          nextWidget,
        );
    onChange(spec.id, nextValue);

    if (
      !transition.immediateFeedback &&
      onRequestFeedback &&
      widgetForRequest.feedback.mode === "explicit_submit" &&
      nextValue != null
    ) {
      await onRequestFeedback(spec.id, spec.type, nextValue);
    }
  }

  function stageExplicitMove(from: string, to: string) {
    setDraftMove({ from, to });
    setSelectedSquare(null);
    setLegalTargets([]);
    setTransitionError(null);
    setTransitionFeedback(null);
  }

  async function handleSquareClick(square: string) {
    if (!allowInput || boardLocked) {
      return;
    }

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null);
        setLegalTargets([]);
        setDraftMove(null);
        return;
      }

      if (legalTargets.includes(square)) {
        if (widgetForRequest.interaction.submissionMode === "explicit_submit") {
          stageExplicitMove(selectedSquare, square);
          return;
        }
        await submitMove(selectedSquare, square);
        return;
      }
    }

    await handleSquareSelection(square);
  }

  async function handleReset() {
    if (boardLocked || !allowReset) {
      return;
    }

    const transition = await requestTransition({ type: "reset" });
    if (!transition) {
      return;
    }

    setRuntimeWidget(transition.canonicalWidget as ChessBoardWidgetPayload);
    setSelectedSquare(null);
    surfaceDrag.cancel();
    setLegalTargets([]);
    setDraftMove(null);
    setTransitionError(null);
    setTransitionFeedback(null);
    onChange(spec.id, transition.nextResponse ?? null);
  }

  async function handleSubmitDraftMove() {
    if (!draftMove) {
      return;
    }
    await submitMove(draftMove.from, draftMove.to);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
            {instructionText && (
              <p className="text-sm text-muted-foreground">{instructionText}</p>
            )}
            {moveHint && (
              <p className="text-xs text-muted-foreground">{moveHint}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {widgetForRequest.display.showSideToMove && (
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
                  {sideToMoveLabel}
                </span>
              )}
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                {orientation === "white" ? "White at bottom" : "Black at bottom"}
              </span>
            </div>

            {allowReset && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={boardLocked}
                className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {caption && (
          <p className="text-xs text-muted-foreground">{caption}</p>
        )}

        <div className="min-h-4">
          {transitionError && (
            <p className="text-xs text-destructive">{transitionError}</p>
          )}
          {pendingTransition && (
            <p className="text-xs text-muted-foreground">Updating board...</p>
          )}
          {!pendingTransition && inlineFeedback && (
            <p
              className={cn(
                "text-xs",
                inlineFeedback.status === "correct" ? "text-emerald-700" : "text-muted-foreground",
              )}
            >
              {inlineFeedback.feedbackMessage}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-3 sm:p-4">
        <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border/70 bg-[#efe7d3] shadow-sm">
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                {["green", "blue", "yellow", "red"].map((color) => (
                  <marker
                    key={color}
                    id={`${markerId}-${color}`}
                    markerWidth="4"
                    markerHeight="4"
                    refX="3"
                    refY="2"
                    orient="auto"
                  >
                    <path d="M0,0 L4,2 L0,4 z" fill={arrowColor(color)} />
                  </marker>
                ))}
              </defs>
              {annotations.arrows.map((arrow, index) => {
                const from = squareCenterPercent(arrow.fromSquare, orientation);
                const to = squareCenterPercent(arrow.toSquare, orientation);
                return (
                  <line
                    key={`${arrow.fromSquare}-${arrow.toSquare}-${index}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={arrowColor(arrow.color)}
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    markerEnd={`url(#${markerId}-${arrow.color})`}
                  />
                );
              })}
            </svg>

            {pendingTransition && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  Updating board...
                </span>
              </div>
            )}

            <div
              ref={surfaceDrag.containerRef}
              className="grid h-full w-full grid-cols-8 grid-rows-8 gap-px bg-border/40 touch-none"
            >
              {ranks.map((rank) =>
                files.map((file) => {
                  const square = `${file}${rank}`;
                  const piece = parsedPosition.pieces.get(square);
                  const rankIndex = orientation === "black" ? RANKS_BLACK.indexOf(rank) : RANKS_WHITE.indexOf(rank);
                  const isDarkSquare = (FILES.indexOf(file) + rankIndex) % 2 === 1;
                  const isSelected = selectedSquare === square;
                  const isLegalTarget = legalTargets.includes(square);
                  const isHighlighted = annotations.highlightSquares.includes(square);
                  const isDraftTarget = draftMove?.to === square;
                  const isDraftSource = draftMove?.from === square;
                  const isDragSource = surfaceDrag.state.dragging === square;
                  const isDragHover = surfaceDrag.state.hoverTarget === square && surfaceDrag.isDragging;
                  const topLeftRank = widgetForRequest.display.showCoordinates && file === files[0];
                  const bottomRightFile = widgetForRequest.display.showCoordinates && rank === ranks[ranks.length - 1];
                  const dragHandlers = piece && dragEnabled ? surfaceDrag.getHandlers(square) : undefined;

                  return (
                    <button
                      key={square}
                      type="button"
                      disabled={!allowInput || boardLocked}
                      onClick={() => void handleSquareClick(square)}
                      {...dragHandlers}
                      data-square={square}
                      data-drag-id={square}
                      data-piece={piece ? `${piece.color}${piece.type}` : undefined}
                      aria-label={square}
                      className={cn(
                        "group relative flex aspect-square min-w-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        isDarkSquare ? "bg-[#7b5e45]" : "bg-[#f7f0dd]",
                        !allowInput && "cursor-default",
                        boardLocked && "cursor-wait",
                        isSelected && "outline outline-2 outline-offset-[-2px] outline-primary",
                        isLegalTarget && "ring-2 ring-inset ring-primary/45",
                        isHighlighted && "ring-2 ring-inset ring-amber-400/70",
                        (isDraftSource || isDraftTarget) && "ring-2 ring-inset ring-sky-500/65",
                        isDragHover && "ring-2 ring-inset ring-primary/60",
                      )}
                    >
                      {topLeftRank && (
                        <span className="pointer-events-none absolute left-1 top-1 text-[10px] font-medium text-black/55">
                          {rank}
                        </span>
                      )}
                      {bottomRightFile && (
                        <span className="pointer-events-none absolute bottom-1 right-1 text-[10px] font-medium text-black/55">
                          {file}
                        </span>
                      )}

                      {isLegalTarget && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none absolute rounded-full bg-primary/30",
                            piece ? "inset-[18%] border border-primary/25" : "size-3.5",
                          )}
                        />
                      )}

                      {piece ? (
                        <span
                          className={cn(
                            "relative z-10 select-none text-[clamp(1.45rem,4.6vw,2.35rem)] leading-none",
                            piece.color === "w" ? "text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]" : "text-slate-950",
                            dragEnabled && "cursor-grab active:cursor-grabbing",
                            isDragSource && "opacity-40",
                          )}
                        >
                          {PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
                        </span>
                      ) : null}
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          {widgetForRequest.interaction.submissionMode === "explicit_submit" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {draftMove ? `Draft move: ${draftMove.from} to ${draftMove.to}` : "No move selected yet"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Submit the move only when you are ready to check it.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSubmitDraftMove()}
                disabled={!draftMove || boardLocked}
                className="h-8 px-3 text-xs"
              >
                Submit move
              </Button>
            </div>
          )}
        </div>
      </div>

      {(widgetForRequest.evaluation.expectedMoves.length > 0 || annotations.highlightSquares.length > 0) && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {widgetForRequest.evaluation.expectedMoves.length > 0 && (
            <span className="rounded-full border border-border px-2 py-0.5">
              Bounded move target
            </span>
          )}
          {annotations.highlightSquares.length > 0 && (
            <span className="rounded-full border border-border px-2 py-0.5">
              Board annotations
            </span>
          )}
        </div>
      )}
    </div>
  );
}
