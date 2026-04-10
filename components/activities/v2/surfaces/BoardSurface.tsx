"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ComponentRendererProps } from "../types";
import type {
  ChessBoardWidgetPayload,
  InteractiveWidgetComponent,
} from "@/lib/activities/widgets";
import {
  type BoardSurfaceMove,
  BoardSurfaceMoveSchema,
} from "@/lib/activities/widgets";

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

function readFen(value: unknown, fallbackFen: string | undefined) {
  const parsed = readMoveFromValue(value);
  if (parsed?.fenAfter) {
    return parsed.fenAfter;
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
    return "Choose a piece, choose its destination, then submit the move.";
  }

  return "Choose a piece, then choose its destination.";
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
  const widget: ChessBoardWidgetPayload = spec.widget;
  const [currentWidget, setCurrentWidget] = React.useState<ChessBoardWidgetPayload>(widget);
  const [selectedSquare, setSelectedSquare] = React.useState<string | null>(null);
  const [draggedSquare, setDraggedSquare] = React.useState<string | null>(null);
  const [legalTargets, setLegalTargets] = React.useState<string[]>([]);
  const [draftMove, setDraftMove] = React.useState<{ from: string; to: string } | null>(null);
  const [pendingTransition, setPendingTransition] = React.useState(false);
  const [transitionError, setTransitionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrentWidget(widget);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setLegalTargets([]);
    setDraftMove(null);
    setTransitionError(null);
  }, [widget]);

  const renderFen = readFen(value, currentWidget.state.fen);
  const widgetForRequest: ChessBoardWidgetPayload = {
    ...currentWidget,
    state: {
      ...currentWidget.state,
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

  const boardLocked = disabled || pendingTransition || (feedback != null && feedback.allowRetry === false);
  const allowInput = widgetForRequest.interaction.mode === "move_input";
  const files = orientation === "black" ? [...FILES].reverse() : [...FILES];
  const ranks = orientation === "black" ? [...RANKS_BLACK] : [...RANKS_WHITE];
  const inlineFeedback = widgetForRequest.feedback.displayMode === "inline" ? feedback : null;
  const sideToMoveLabel = parsedPosition.sideToMove === "white" ? "White to move" : "Black to move";
  const moveHint = buildMoveHint(widgetForRequest);
  const annotations = widgetForRequest.annotations ?? { arrows: [], highlightSquares: [] };

  async function requestTransition(
    learnerAction:
      | { type: "select_square"; square: string }
      | { type: "submit_move"; move: Record<string, unknown> }
      | { type: "reset" },
    currentValue: unknown = value,
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
        currentValue,
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
      return;
    }

    setCurrentWidget(transition.canonicalWidget as ChessBoardWidgetPayload);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setLegalTargets([]);
    setDraftMove(null);
    setTransitionError(null);
    onChange(spec.id, transition.nextResponse ?? transition.normalizedLearnerAction ?? {});

    if (!transition.immediateFeedback && onRequestFeedback && widgetForRequest.feedback.mode === "explicit_submit") {
      await onRequestFeedback(
        spec.id,
        spec.type,
        transition.nextResponse ?? transition.normalizedLearnerAction ?? {},
      );
    }
  }

  function stageExplicitMove(from: string, to: string) {
    setDraftMove({ from, to });
    setSelectedSquare(null);
    setLegalTargets([]);
    setTransitionError(null);
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
    if (boardLocked || !widgetForRequest.interaction.allowReset) {
      return;
    }

    const transition = await requestTransition({ type: "reset" }, value);
    if (!transition) {
      return;
    }

    setCurrentWidget(transition.canonicalWidget as ChessBoardWidgetPayload);
    setSelectedSquare(null);
    setDraggedSquare(null);
    setLegalTargets([]);
    setDraftMove(null);
    setTransitionError(null);
    onChange(spec.id, transition.nextResponse ?? {});
  }

  async function handleSubmitDraftMove() {
    if (!draftMove) {
      return;
    }
    await submitMove(draftMove.from, draftMove.to);
  }

  const hasPointerDrag = widgetForRequest.interaction.selectionMode !== "click_click";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
          {moveHint && (
            <p className="text-xs text-muted-foreground">{moveHint}</p>
          )}
          {transitionError && (
            <p className="text-xs text-destructive">{transitionError}</p>
          )}
          {pendingTransition && (
            <p className="text-xs text-muted-foreground">Updating board…</p>
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

          {widgetForRequest.interaction.allowReset && (
            <button
              type="button"
              onClick={handleReset}
              disabled={boardLocked}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/90 p-3 sm:p-4">
        <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/70 bg-[#efe7d3] shadow-sm">
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

            <div className="grid h-full grid-cols-8">
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
                  const topLeftRank = widgetForRequest.display.showCoordinates && file === files[0];
                  const bottomRightFile = widgetForRequest.display.showCoordinates && rank === ranks[ranks.length - 1];

                  return (
                    <button
                      key={square}
                      type="button"
                      disabled={!allowInput || boardLocked}
                      onClick={() => void handleSquareClick(square)}
                      onDragOver={(event) => {
                        if (hasPointerDrag && draggedSquare) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!hasPointerDrag || !draggedSquare || draggedSquare === square || boardLocked) {
                          return;
                        }
                        if (widgetForRequest.interaction.submissionMode === "explicit_submit") {
                          stageExplicitMove(draggedSquare, square);
                          return;
                        }
                        void submitMove(draggedSquare, square);
                      }}
                      onDragEnd={() => setDraggedSquare(null)}
                      data-square={square}
                      aria-label={square}
                      className={cn(
                        "group relative flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        isDarkSquare ? "bg-[#7b5e45]" : "bg-[#f7f0dd]",
                        !allowInput && "cursor-default",
                        boardLocked && "cursor-wait",
                        isSelected && "outline outline-2 outline-offset-[-2px] outline-primary",
                        isLegalTarget && "ring-2 ring-inset ring-primary/45",
                        isHighlighted && "ring-2 ring-inset ring-amber-400/70",
                        (isDraftSource || isDraftTarget) && "ring-2 ring-inset ring-sky-500/65",
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
                            piece ? "inset-2 border border-primary/25" : "size-3",
                          )}
                        />
                      )}

                      {piece ? (
                        <span
                          draggable={allowInput && hasPointerDrag && !boardLocked}
                          onDragStart={() => {
                            if (!hasPointerDrag || boardLocked) {
                              return;
                            }
                            setDraggedSquare(square);
                            void handleSquareSelection(square);
                          }}
                          className={cn(
                            "relative z-10 select-none text-[clamp(1.45rem,4.6vw,2.35rem)] leading-none",
                            piece.color === "w" ? "text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]" : "text-slate-950",
                            allowInput && !boardLocked && "cursor-grab active:cursor-grabbing",
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
              <button
                type="button"
                onClick={() => void handleSubmitDraftMove()}
                disabled={!draftMove || boardLocked}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit move
              </button>
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
