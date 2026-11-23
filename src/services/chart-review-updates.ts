/**
 * A lightweight shared signal so that a successful in-article chart review
 * decision refreshes the admin notification immediately, without waiting for
 * its minute-long poll. No chart data or credentials pass through this signal.
 */
const listeners = new Set<() => void>();

export function subscribeChartReviewUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitChartReviewUpdate(): void {
  for (const listener of listeners) listener();
}
