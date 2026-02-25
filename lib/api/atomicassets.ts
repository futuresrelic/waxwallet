// ─── AtomicAssets API Client ──────────────────────────────────────────────────
// Server-side only. Use via Next.js API routes.

import { pickEndpoint, markSuccess, markFailure } from '../endpoint-pool';
import type {
  AtomicAssetsResponse,
  AssetData,
  CollectionData,
  SchemaData,
  TemplateData,
} from '../types';

const TIMEOUT_MS = 10_000;

// ─── M14: Request deduplication ───────────────────────────────────────────────
// If two callers request the same URL simultaneously, only one network request
// is made and both callers receive the same Promise. The map is cleared when
// the request completes (success or failure).
const inflight = new Map<string, Promise<unknown>>();

// ─── M14: Concurrency semaphore ───────────────────────────────────────────────
// Limits simultaneous outbound AtomicAssets requests. Background scans can
// saturate all 3 PARALLEL slots at once; without a limit, many concurrent
// Next.js API requests can open dozens of connections simultaneously.
const MAX_CONCURRENT = 12;
let semCount = 0;
const semWaiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (semCount < MAX_CONCURRENT) {
    semCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => semWaiters.push(resolve));
}

function releaseSlot(): void {
  const next = semWaiters.shift();
  if (next) {
    next(); // waiter takes the slot; semCount stays the same
  } else {
    semCount--;
  }
}

// ─── Internal fetch with retries (no dedup/semaphore) ─────────────────────────

async function performFetch<T>(path: string, retries: number): Promise<T> {
  await acquireSlot();
  let lastError: Error | null = null;

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const base = pickEndpoint();
      const url = `${base}/atomicassets/v1${path}`;
      const start = Date.now();

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        // cache: 'no-store' prevents Next.js from writing AtomicAssets responses
        // into its Data Cache. Responses >2MB (large accounts / 1000-item pages)
        // caused "Failed to set Next.js data cache … items over 2MB" errors that
        // surfaced as 500s on Railway. HTTP Cache-Control headers on our own API
        // routes (CDN layer) and React Query (client) provide all caching needed.
        const res = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });

        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} from ${base}`);
        }

        const json = (await res.json()) as AtomicAssetsResponse<T>;
        markSuccess(base, Date.now() - start);

        if (!json.success) {
          throw new Error(`API error: ${JSON.stringify(json)}`);
        }

        return json.data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        markFailure(base, lastError.message);
        console.error(`[AtomicAssets] attempt ${attempt + 1} failed for ${path}:`, lastError.message);
      }
    }
  } finally {
    releaseSlot();
  }

  throw lastError ?? new Error('All endpoints failed');
}

// ─── Public fetch: deduplication + semaphore ──────────────────────────────────

async function apiFetch<T>(path: string, retries = 2): Promise<T> {
  // Deduplication: if an identical request is already in-flight, share it
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;

  const promise = performFetch<T>(path, retries);
  inflight.set(path, promise as Promise<unknown>);
  // Remove from map when done regardless of outcome
  void promise.finally(() => inflight.delete(path));
  return promise;
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export interface AssetsQuery {
  owner: string;
  collection_name?: string;
  schema_name?: string;
  template_id?: string;
  match?: string;
  order?: string;
  sort?: string;
  page?: number;
  limit?: number;
  burned?: boolean;
  /** Server-side rarity filter: maps to template_data.rarity=X on AtomicAssets API */
  attr_rarity?: string;
  /** Generic attribute filters: maps to template_data.{key}={value} on AtomicAssets API */
  attr_filters?: Record<string, string>;
  /** Internal: bypass 100-per-page cap (used by stack aggregation only) */
  _uncapped?: boolean;
}

export async function getAssets(query: AssetsQuery): Promise<AssetData[]> {
  const params = new URLSearchParams();
  params.set('owner', query.owner);

  // AtomicAssets: single collection → collection_name, multiple → collection_whitelist
  if (query.collection_name) {
    const cols = query.collection_name.split(',').map((s) => s.trim()).filter(Boolean);
    if (cols.length === 1) {
      params.set('collection_name', cols[0]);
    } else if (cols.length > 1) {
      params.set('collection_whitelist', cols.join(','));
    }
  }

  // AtomicAssets: single schema → schema_name, multiple → schema_whitelist
  if (query.schema_name) {
    const schemas = query.schema_name.split(',').map((s) => s.trim()).filter(Boolean);
    if (schemas.length === 1) {
      params.set('schema_name', schemas[0]);
    } else if (schemas.length > 1) {
      params.set('schema_whitelist', schemas.join(','));
    }
  }

  if (query.template_id) params.set('template_id', query.template_id);
  if (query.match) params.set('match', query.match);

  const sortFull = (query.sort ?? 'asset_id:desc').split(':');
  params.set('sort', sortFull[0]);
  params.set('order', sortFull[1] ?? 'desc');

  params.set('page', String(query.page ?? 1));
  const maxLimit = query._uncapped ? 1000 : 100;
  params.set('limit', String(Math.min(query.limit ?? 40, maxLimit)));
  if (query.burned === true) params.set('burned', 'true');
  if (query.attr_rarity) params.set('template_data.rarity', query.attr_rarity);
  if (query.attr_filters) {
    for (const [key, value] of Object.entries(query.attr_filters)) {
      if (value) params.set(`template_data.${key}`, value);
    }
  }

  return apiFetch<AssetData[]>(`/assets?${params.toString()}`);
}

export async function getAsset(assetId: string): Promise<AssetData> {
  return apiFetch<AssetData>(`/assets/${assetId}`);
}

// ─── Collections ──────────────────────────────────────────────────────────────

export async function getAccountCollections(owner: string): Promise<CollectionData[]> {
  return apiFetch<CollectionData[]>(`/accounts/${owner}`).catch(() => []);
}

export async function getCollection(collectionName: string): Promise<CollectionData> {
  return apiFetch<CollectionData>(`/collections/${collectionName}`);
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

export async function getSchemas(collectionName: string): Promise<SchemaData[]> {
  return apiFetch<SchemaData[]>(`/schemas?collection_name=${collectionName}&limit=100`);
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplate(collectionName: string, templateId: string): Promise<TemplateData> {
  return apiFetch<TemplateData>(`/templates/${collectionName}/${templateId}`);
}

// ─── Account summary ─────────────────────────────────────────────────────────

export interface AccountSummary {
  collections: Array<{ collection: CollectionData; assets: number }>;
}

export async function getAccountSummary(owner: string): Promise<AccountSummary> {
  // AtomicAssets /accounts/{owner} returns an object:
  //   { collections: [...], templates: [...], schemas: [...] }
  // apiFetch() unwraps json.data, so `raw` is that object — NOT the collections array.
  // Previously this function did `return { collections: raw }` which produced double-nesting:
  //   { collections: { collections: [...] } }  ← WRONG
  // Fix: extract raw.collections (the actual array) and fall back gracefully.
  type RawAccount = { collections: AccountSummary['collections'] } & Record<string, unknown>;
  const raw = await apiFetch<RawAccount | AccountSummary['collections']>(`/accounts/${owner}`);
  const cols: AccountSummary['collections'] = Array.isArray(raw)
    ? (raw as AccountSummary['collections'])
    : Array.isArray((raw as RawAccount).collections)
      ? (raw as RawAccount).collections
      : [];
  return { collections: cols };
}
