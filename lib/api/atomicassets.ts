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

async function apiFetch<T>(path: string, retries = 2): Promise<T> {
  let lastError: Error | null = null;

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
      console.error(`[AtomicAssets] attempt ${attempt + 1} failed for ${url}:`, lastError.message);
    }
  }

  throw lastError ?? new Error('All endpoints failed');
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
  /** Internal: bypass 100-per-page cap (used by stack aggregation only) */
  _uncapped?: boolean;
}

export async function getAssets(query: AssetsQuery): Promise<AssetData[]> {
  const params = new URLSearchParams();
  params.set('owner', query.owner);
  if (query.collection_name) params.set('collection_name', query.collection_name);
  if (query.schema_name) params.set('schema_name', query.schema_name);
  if (query.template_id) params.set('template_id', query.template_id);
  if (query.match) params.set('match', query.match);

  const sortFull = (query.sort ?? 'asset_id:desc').split(':');
  params.set('sort', sortFull[0]);
  params.set('order', sortFull[1] ?? 'desc');

  params.set('page', String(query.page ?? 1));
  const maxLimit = query._uncapped ? 1000 : 100;
  params.set('limit', String(Math.min(query.limit ?? 40, maxLimit)));
  if (query.burned === true) params.set('burned', 'true');

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
  const data = await apiFetch<AccountSummary['collections']>(`/accounts/${owner}`);
  return { collections: data };
}
