export interface HistoryState<T> { past: T[]; present: T; future: T[] }

export function createHistory<T>(initial: T): HistoryState<T> { return { past: [], present: initial, future: [] }; }
export function commitHistory<T>(history: HistoryState<T>, next: T, limit = 50): HistoryState<T> {
  return { past: [...history.past, history.present].slice(-limit), present: next, future: [] };
}
export function undo<T>(history: HistoryState<T>): HistoryState<T> {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}
export function redo<T>(history: HistoryState<T>): HistoryState<T> {
  if (!history.future.length) return history;
  const next = history.future[0];
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}
