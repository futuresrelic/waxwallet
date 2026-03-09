// ─── Cleanup Opportunities Aggregator ────────────────────────────────────────
// Collects all CleanupItems from every RAM analyzer result, sorts by impact,
// and returns a summary for the top-of-page "Cleanup Opportunities" section.

import type { AnalyzerResult, CleanupItem } from '../types';

export interface CleanupSummary {
  /** All reclaimable items, sorted by estimated bytes descending. */
  reclaimable: CleanupItem[];
  /** Items where RAM is NOT held by this account. */
  notReclaimable: CleanupItem[];
  /** Total estimated bytes that COULD be recovered. */
  totalReclaimableBytes: number;
  /** Total rows that could be cleared. */
  totalReclaimableCount: number;
}

export function aggregateCleanupOpportunities(
  results: AnalyzerResult[],
): CleanupSummary {
  const all: CleanupItem[] = results.flatMap(r => r.cleanupItems ?? []);

  const reclaimable = all
    .filter(c => c.reclaimable === 'yes' || c.reclaimable === 'maybe')
    .sort((a, b) => b.estimatedBytes - a.estimatedBytes);

  const notReclaimable = all.filter(c => c.reclaimable === 'no');

  const totalReclaimableBytes = reclaimable.reduce((s, c) => s + c.estimatedBytes, 0);
  const totalReclaimableCount = reclaimable.reduce((s, c) => s + c.count, 0);

  return { reclaimable, notReclaimable, totalReclaimableBytes, totalReclaimableCount };
}
