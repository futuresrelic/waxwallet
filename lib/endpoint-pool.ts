// ─── Endpoint Pool & Health Management ───────────────────────────────────────
// Manages a pool of AtomicAssets API endpoints, selects the healthiest one,
// and falls back automatically when an endpoint fails.

import type { EndpointHealth } from './types';

const DEFAULT_ENDPOINTS = (process.env.ATOMICASSETS_ENDPOINTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (DEFAULT_ENDPOINTS.length === 0) {
  DEFAULT_ENDPOINTS.push(
    'https://wax.api.atomicassets.io',
    'https://aa.wax.blacklusion.io',
    'https://wax-aa.eu.eosamsterdam.net',
    'https://atomic.wax.eosrio.io',
  );
}

interface PoolEntry {
  url: string;
  failCount: number;
  lastFailTime: number;
  lastSuccessTime: number;
  latencyMs: number;
}

// In-process singleton (survives within one Node process)
const pool: Map<string, PoolEntry> = new Map();

// Stats for admin panel
export const stats = {
  totalRequests: 0,
  errorCountLastHour: 0,
  lastSuccessfulCall: null as string | null,
  startedAt: Date.now(),
  errors: [] as Array<{ time: number; endpoint: string; message: string }>,
};

function getPool(): PoolEntry[] {
  // Lazily initialise from env or defaults
  if (pool.size === 0) {
    for (const url of DEFAULT_ENDPOINTS) {
      pool.set(url, { url, failCount: 0, lastFailTime: 0, lastSuccessTime: 0, latencyMs: 0 });
    }
  }
  return Array.from(pool.values());
}

export function getEndpoints(): string[] {
  return getPool().map((e) => e.url);
}

export function setEndpoints(urls: string[]): void {
  pool.clear();
  for (const url of urls) {
    pool.set(url, { url, failCount: 0, lastFailTime: 0, lastSuccessTime: 0, latencyMs: 0 });
  }
}

/** Returns the best available endpoint URL */
export function pickEndpoint(): string {
  const entries = getPool();
  const now = Date.now();
  const COOLDOWN = 30_000; // 30s before retrying a failed endpoint

  // Prefer endpoints with no recent failures
  const healthy = entries.filter((e) => e.failCount === 0 || now - e.lastFailTime > COOLDOWN);
  if (healthy.length > 0) {
    // Prefer fastest by latency
    healthy.sort((a, b) => {
      if (a.latencyMs === 0) return 1;
      if (b.latencyMs === 0) return -1;
      return a.latencyMs - b.latencyMs;
    });
    return healthy[0].url;
  }

  // All failed recently - return least recently failed
  entries.sort((a, b) => a.lastFailTime - b.lastFailTime);
  return entries[0].url;
}

export function markSuccess(url: string, latencyMs: number): void {
  const entry = pool.get(url);
  if (entry) {
    entry.failCount = 0;
    entry.latencyMs = latencyMs;
    entry.lastSuccessTime = Date.now();
  }
  stats.lastSuccessfulCall = new Date().toISOString();
  stats.totalRequests++;
}

export function markFailure(url: string, message: string): void {
  const entry = pool.get(url);
  if (entry) {
    entry.failCount++;
    entry.lastFailTime = Date.now();
  }
  const errorEntry = { time: Date.now(), endpoint: url, message };
  stats.errors.push(errorEntry);
  // Trim to last 200 errors
  if (stats.errors.length > 200) stats.errors.splice(0, stats.errors.length - 200);
  stats.totalRequests++;

  // Update per-hour count
  const hourAgo = Date.now() - 3_600_000;
  stats.errorCountLastHour = stats.errors.filter((e) => e.time > hourAgo).length;
}

export function getHealthStatus(): EndpointHealth[] {
  return getPool().map((e) => ({
    url: e.url,
    healthy: e.failCount === 0 || Date.now() - e.lastFailTime > 30_000,
    latencyMs: e.latencyMs || undefined,
    lastChecked: e.lastSuccessTime ? new Date(e.lastSuccessTime).toISOString() : 'never',
    lastError: undefined,
  }));
}
