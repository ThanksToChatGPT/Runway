// Deshacer/rehacer (FR-28) como historial de estados inmutables (patrón Memento).
export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

export function commit<T>(h: HistoryState<T>, next: T): HistoryState<T> {
  return {
    past: [...h.past.slice(-29), h.present],
    present: next,
    future: [],
  };
}

export function undo<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.past.length === 0) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
  };
}

export function redo<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.future.length === 0) return h;
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
  };
}
