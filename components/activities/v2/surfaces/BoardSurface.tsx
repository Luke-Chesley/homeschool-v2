"use client";

import * as React from "react";
import { Chess, type Square } from "chess.js";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentRendererProps } from "../types";
import type {
  BoardSurfaceMove,
  ChessBoardWidgetPayload,
  InteractiveWidgetComponent,
} from "@/lib/activities/widgets";
import { BoardSurfaceMoveSchema } from "@/lib/activities/widgets";

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

function createGame(fen: string) {
  try {
    return new Chess(fen);
  } catch {
    return new Chess();
  }
}

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
      return "rgb(59 130 246 / 0.75)";
    case "yellow":
      return "rgb(234 179 8 / 0.78)";
    case "red":
      return "rgb(239 68 68 / 0.8)";
    default:
      return "rgb(34 197 94 / 0.78)";
  }
}

export function BoardSurface({
  spec,
  value,
  onChange,
  onRequestFeedback,
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
  const allowInput = widget.interaction.mode === "move_input";
  const [positionFen, setPositionFen] = React.useState(() => readFen(value, widget.state.fen));
  const [selectedSquare, setSelectedSquare] = React.useState<string | null>(null);
  const [pendingFeedback, setPendingFeedback] = React.useState(false);

  React.useEffect(() => {
    setPositionFen(readFen(value, widget.state.fen));
    setSelectedSquare(null);
  }, [value, widget.state.fen]);

  const game = createGame(positionFen);
  const boardLocked = disabled || (feedback != null && feedback.allowRetry === false);
  const files = orientation === "black" ? [...FILES].reverse() : [...FILES];
  const ranks = orientation === "black" ? [...RANKS_BLACK] : [...RANKS_WHITE];
  const legalMoves = selectedSquare && allowInput
    ? game.moves({ square: selectedSquare as Square, verbose: true })
    : [];

  function applyMove(from: string, to: string) {
    const nextGame = createGame(positionFen);
    const move = nextGame.move({
      from: from as Square,
      to: to as Square,
      promotion: "q",
    });

    if (!move) {
      return null;
    }

    const nextValue: BoardSurfaceMove = {
      from: move.from,
      to: move.to,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      promotion:
        move.promotion === "q" ||
        move.promotion === "r" ||
        move.promotion === "b" ||
        move.promotion === "n"
          ? move.promotion
          : undefined,
      fenAfter: nextGame.fen(),
    };

    setPositionFen(nextGame.fen());
    setSelectedSquare(null);
    onChange(spec.id, nextValue);
    return nextValue;
  }

  async function requestFeedback(nextValue: BoardSurfaceMove) {
    if (!onRequestFeedback || !allowInput) {
      return;
    }

    setPendingFeedback(true);
    try {
      await onRequestFeedback(spec.id, spec.type, nextValue);
    } finally {
      setPendingFeedback(false);
    }
  }

  function handleSquareClick(square: string) {
    if (!allowInput || boardLocked) {
      return;
    }

    const piece = game.get(square as Square);

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null);
        return;
      }

      const nextValue = applyMove(selectedSquare, square);
      if (nextValue) {
        void requestFeedback(nextValue);
        return;
      }

      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        return;
      }

      setSelectedSquare(null);
      return;
    }

    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
    }
  }

  function handleReset() {
    if (boardLocked) {
      return;
    }

    setPositionFen(widget.state.fen ?? positionFen);
    setSelectedSquare(null);
    onChange(spec.id, {});
  }

  const annotations = widget.annotations ?? { arrows: [], highlightSquares: [] };
  const hasHints = widget.evaluation.expectedMoves.length > 0 || annotations.highlightSquares.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
          {allowInput && (
            <p className="text-xs text-muted-foreground">
              Pick a piece, then choose its destination.
            </p>
          )}
          {pendingFeedback && (
            <p className="text-xs text-muted-foreground">Checking move…</p>
          )}
          {!pendingFeedback && feedback && (
            <p className={cn(
              "text-xs",
              feedback.status === "correct" ? "text-emerald-700" : "text-muted-foreground",
            )}>
              {feedback.feedbackMessage}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-xs text-muted-foreground">
            {orientation === "white" ? "White at bottom" : "Black at bottom"}
          </p>
          {allowInput && (
            <button
              type="button"
              onClick={handleReset}
              disabled={boardLocked}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
        <div className="relative aspect-square w-full max-w-[30rem] overflow-hidden rounded-xl border border-border/60 bg-background/80">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
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
                  strokeWidth="1.8"
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
                const piece = game.get(square as Square);
                const isDarkSquare = (FILES.indexOf(file) + (orientation === "black" ? RANKS_BLACK.indexOf(rank) : RANKS_WHITE.indexOf(rank))) % 2 === 1;
                const isSelected = selectedSquare === square;
                const isLegalTarget = legalMoves.some((move) => move.to === square);
                const isHighlighted = annotations.highlightSquares.includes(square);

                return (
                  <button
                    key={square}
                    type="button"
                    disabled={!allowInput || boardLocked}
                    onClick={() => handleSquareClick(square)}
                    data-square={square}
                    data-piece={piece ? `${piece.color}${piece.type}` : ""}
                    aria-label={square}
                    className={cn(
                      "relative flex items-center justify-center text-2xl transition-colors",
                      isDarkSquare ? "bg-[#6f8f66]" : "bg-[#e7ecd9]",
                      isSelected && "outline outline-2 outline-offset-[-2px] outline-primary",
                      isLegalTarget && "ring-2 ring-inset ring-primary/40",
                      isHighlighted && "ring-2 ring-inset ring-amber-400/60",
                      !allowInput && "cursor-default",
                    )}
                  >
                    {piece ? (
                      <span className={cn(piece.color === "w" ? "text-foreground" : "text-slate-800")}>
                        {PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
                      </span>
                    ) : null}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>

      {hasHints && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {widget.evaluation.expectedMoves.length > 0 && (
            <span className="rounded-full border border-border px-2 py-0.5">
              Move target set
            </span>
          )}
          {annotations.highlightSquares.length > 0 && (
            <span className="rounded-full border border-border px-2 py-0.5">
              Highlights included
            </span>
          )}
        </div>
      )}
    </div>
  );
}
