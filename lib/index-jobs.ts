// ─── Background index job tracker ────────────────────────────────────────────
// Prevents duplicate full-wallet scans when multiple requests arrive while
// an aggregation is already running. Uses a module-level Map that persists
// across requests (same Node.js process lifetime on Railway).
//
// Usage:
//   if (!isIndexing(key)) startIndexJob(key, async () => { ... });
//   if (isIndexing(key)) { /* return partial data + meta.indexing: true */ }

type G = typeof global & { _waxJobs?: Map<string, Promise<void>> };
const g = global as G;
if (!g._waxJobs) g._waxJobs = new Map();
const jobs = g._waxJobs;

/** Returns true if a background job for this cache key is currently running. */
export function isIndexing(key: string): boolean {
  return jobs.has(key);
}

/**
 * Start a background job for the given cache key.
 * No-op if a job for this key is already in progress.
 * The job is removed from the tracker when it completes (or fails).
 */
export function startIndexJob(key: string, fn: () => Promise<void>): void {
  if (jobs.has(key)) return;
  const job = fn()
    .catch((err: unknown) => {
      console.error('[IndexJob] background scan failed for key', key, err instanceof Error ? err.message : err);
    })
    .finally(() => {
      jobs.delete(key);
    });
  jobs.set(key, job);
}
