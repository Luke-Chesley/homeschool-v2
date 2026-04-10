"use client";

import * as React from "react";

/**
 * Generic pointer-event-based drag hook for widget surfaces.
 *
 * Replaces HTML5 Drag and Drop, which doesn't work on touch devices, breaks
 * on disabled elements, and fires no events during pending async operations.
 *
 * Any surface that needs gesture capture (board, graph, expression) can use
 * this hook. It translates raw pointer gestures into semantic callbacks:
 *   onDragStart(sourceId)      — user begins dragging from an element
 *   onDragEnd(sourceId, targetId) — user drops onto a target element
 *   onDragCancel()             — drag ended outside any target
 *
 * The hook owns visual drag feedback (floating clone that follows the pointer)
 * and state tracking. The surface only needs to wire `getHandlers(id)` onto
 * its interactive elements and attach `containerRef` to the drag area.
 *
 * Design constraints:
 * - Uses pointer events, not mouse events — works on touch and pen
 * - Tracks drag state in refs to avoid re-renders during the gesture
 * - Only triggers React state updates at gesture boundaries (start / end)
 * - Does NOT call backend transitions during the drag — surfaces should
 *   only hit the backend when the gesture resolves
 */

const DRAG_THRESHOLD_PX = 5;

export interface SurfaceDragCallbacks {
  /** Fired once when the drag gesture is confirmed (past threshold). */
  onDragStart?: (sourceId: string) => void;
  /** Fired when the user drops on a valid target. */
  onDragEnd?: (sourceId: string, targetId: string | null) => void;
  /** Fired when the drag is cancelled (pointer up outside any target). */
  onDragCancel?: () => void;
}

export interface SurfaceDragState {
  /** Currently dragged element id, or null. */
  dragging: string | null;
  /** The id of the element currently under the pointer during drag, or null. */
  hoverTarget: string | null;
}

export interface SurfaceDragResult {
  /** Current drag state — read this for visual feedback in the surface. */
  state: SurfaceDragState;
  /** Attach this ref to the container element that bounds the drag area. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Returns pointer event handlers for a draggable element.
   * The surface attaches these to each interactive cell/point/term.
   */
  getHandlers: (elementId: string) => {
    onPointerDown: (event: React.PointerEvent) => void;
  };
  /** Whether a drag is currently in progress. */
  isDragging: boolean;
  /** Imperatively cancel a drag (e.g. when the surface is disabled). */
  cancel: () => void;
}

export function useSurfaceDrag(
  callbacks: SurfaceDragCallbacks,
  options: {
    /** When true, drag gestures are ignored. */
    disabled?: boolean;
    /**
     * Resolve a point (relative to the container) to a target element id.
     * If omitted, the hook uses `document.elementFromPoint` and reads
     * `data-drag-id` from the element under the pointer.
     */
    hitTest?: (point: { x: number; y: number }) => string | null;
  } = {},
): SurfaceDragResult {
  const { disabled = false, hitTest } = options;

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Track drag in refs to avoid re-renders during pointer move.
  const dragRef = React.useRef<{
    sourceId: string;
    startX: number;
    startY: number;
    confirmed: boolean;
    pointerId: number;
    clone: HTMLElement | null;
  } | null>(null);

  // React state updated only at gesture boundaries for render feedback.
  const [state, setState] = React.useState<SurfaceDragState>({
    dragging: null,
    hoverTarget: null,
  });

  const callbacksRef = React.useRef(callbacks);
  callbacksRef.current = callbacks;

  const hitTestRef = React.useRef(hitTest);
  hitTestRef.current = hitTest;

  const resolveTarget = React.useCallback(
    (clientX: number, clientY: number): string | null => {
      if (hitTestRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        return hitTestRef.current({ x: clientX - rect.left, y: clientY - rect.top });
      }
      // Default: find the nearest element with data-drag-id under the pointer.
      const elements = document.elementsFromPoint(clientX, clientY);
      for (const el of elements) {
        const id = (el as HTMLElement).dataset?.dragId;
        if (id !== undefined) {
          return id;
        }
      }
      return null;
    },
    [],
  );

  const cleanupClone = React.useCallback(() => {
    if (dragRef.current?.clone) {
      dragRef.current.clone.remove();
      dragRef.current.clone = null;
    }
  }, []);

  const endDrag = React.useCallback(() => {
    cleanupClone();
    dragRef.current = null;
    setState({ dragging: null, hoverTarget: null });
  }, [cleanupClone]);

  // Pointer move and up are attached to the window so they fire even if
  // the pointer leaves the container.
  React.useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (!drag.confirmed) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
          return;
        }
        drag.confirmed = true;
        callbacksRef.current.onDragStart?.(drag.sourceId);
        setState({ dragging: drag.sourceId, hoverTarget: null });

        // Create a floating clone of the source element for visual feedback.
        if (containerRef.current) {
          const sourceEl = containerRef.current.querySelector(
            `[data-drag-id="${CSS.escape(drag.sourceId)}"]`,
          );
          if (sourceEl) {
            const clone = sourceEl.cloneNode(true) as HTMLElement;
            clone.style.position = "fixed";
            clone.style.pointerEvents = "none";
            clone.style.zIndex = "9999";
            clone.style.opacity = "0.85";
            clone.style.transition = "none";
            clone.style.width = `${sourceEl.getBoundingClientRect().width}px`;
            clone.style.height = `${sourceEl.getBoundingClientRect().height}px`;
            document.body.appendChild(clone);
            drag.clone = clone;
          }
        }
      }

      // Move the floating clone.
      if (drag.clone) {
        const rect = drag.clone.getBoundingClientRect();
        drag.clone.style.left = `${event.clientX - rect.width / 2}px`;
        drag.clone.style.top = `${event.clientY - rect.height / 2}px`;
      }

      // Update hover target for visual feedback on the surface.
      const targetId = resolveTarget(event.clientX, event.clientY);
      setState((prev) => {
        if (prev.hoverTarget === targetId && prev.dragging === drag.sourceId) {
          return prev;
        }
        return { dragging: drag.sourceId, hoverTarget: targetId };
      });
    }

    function onPointerUp(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      if (!drag.confirmed) {
        // Never crossed threshold — treat as a click (the surface's
        // onClick handler will fire normally).
        endDrag();
        return;
      }

      const targetId = resolveTarget(event.clientX, event.clientY);
      if (targetId && targetId !== drag.sourceId) {
        callbacksRef.current.onDragEnd?.(drag.sourceId, targetId);
      } else {
        callbacksRef.current.onDragCancel?.();
      }
      endDrag();
    }

    function onPointerCancel(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      callbacksRef.current.onDragCancel?.();
      endDrag();
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [endDrag, resolveTarget]);

  // Cancel drag when disabled changes.
  React.useEffect(() => {
    if (disabled && dragRef.current) {
      callbacksRef.current.onDragCancel?.();
      endDrag();
    }
  }, [disabled, endDrag]);

  const getHandlers = React.useCallback(
    (elementId: string) => ({
      onPointerDown: (event: React.PointerEvent) => {
        if (disabled || event.button !== 0 || dragRef.current) {
          return;
        }
        // Don't capture yet — let the threshold decide if this is a drag or click.
        dragRef.current = {
          sourceId: elementId,
          startX: event.clientX,
          startY: event.clientY,
          confirmed: false,
          pointerId: event.pointerId,
          clone: null,
        };
      },
    }),
    [disabled],
  );

  return {
    state,
    containerRef,
    getHandlers,
    isDragging: state.dragging !== null,
    cancel: endDrag,
  };
}
