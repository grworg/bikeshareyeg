/**
 * Generic undo/redo hook using immutable snapshots.
 *
 * - `push(state)` records a new snapshot and clears the redo stack.
 * - `replace(state)` updates current without creating a history entry
 *   (useful for continuous slider drags).
 * - `commit()` finalises a sequence of `replace` calls into one undo step.
 *   Call this on `pointerUp` after slider drags.
 * - `undo()` / `redo()` navigate the history.
 *
 * Internally an "anchor" tracks the state before a series of replaces,
 * so that `commit()` pushes the correct pre-drag state to the past stack.
 */

import { useCallback, useState } from "react";

interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** The state at the time of the last push / commit / reset. */
  anchor: T;
}

export interface UndoRedo<T> {
  state: T;
  /** Record a new snapshot (clears redo stack). */
  push: (next: T) => void;
  /** Replace current state without recording history (e.g. slider drag). */
  replace: (next: T) => void;
  /** Commit pending replace ops into one undo step (call on pointer-up). */
  commit: () => void;
  /** Undo last change. */
  undo: () => void;
  /** Redo last undone change. */
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Reset history with a new initial state. */
  reset: (initial: T) => void;
}

const MAX_HISTORY = 200;

export function useUndoRedo<T>(initial: T): UndoRedo<T> {
  const [history, setHistory] = useState<History<T>>({
    past: [],
    present: initial,
    future: [],
    anchor: initial,
  });

  const push = useCallback((next: T) => {
    setHistory((h) => ({
      past: [...h.past, h.present].slice(-MAX_HISTORY),
      present: next,
      future: [],
      anchor: next,
    }));
  }, []);

  const replace = useCallback((next: T) => {
    setHistory((h) => ({ ...h, present: next }));
    // anchor stays the same — it marks the pre-replace state
  }, []);

  const commit = useCallback(() => {
    setHistory((h) => {
      // Nothing changed since last push/commit — skip
      if (h.present === h.anchor) return h;
      return {
        past: [...h.past, h.anchor].slice(-MAX_HISTORY),
        present: h.present,
        future: [],
        anchor: h.present,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: prev,
        future: [h.present, ...h.future].slice(0, MAX_HISTORY),
        anchor: prev,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      return {
        past: [...h.past, h.present].slice(-MAX_HISTORY),
        present: next,
        future: h.future.slice(1),
        anchor: next,
      };
    });
  }, []);

  const reset = useCallback((initial: T) => {
    setHistory({ past: [], present: initial, future: [], anchor: initial });
  }, []);

  return {
    state: history.present,
    push,
    replace,
    commit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    reset,
  };
}
