// Deshacer/rehacer (FR-28) como historial de estados inmutables (patrón Memento).
export const createHistory = present => ({past: [], present, future: []});
export const commit = (h, next) => ({past: [...h.past.slice(-29), h.present], present: next, future: []});
export const undo = h => h.past.length ? {past: h.past.slice(0, -1), present: h.past.at(-1), future: [h.present, ...h.future]} : h;
export const redo = h => h.future.length ? {past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1)} : h;
