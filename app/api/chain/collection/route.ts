// ─── Collection analysis API route ───────────────────────────────────────────
// Correct endpoint usage:
//   collection overview  → /atomicassets/v1/collections/{name}
//   exact asset count    → /atomicassets/v1/collections/{name}/stats
//   schema list          → /atomicassets/v1/schemas?collection_name={name}&limit=100
//   per-schema stats     → /atomicassets/v1/schemas/{name}/{schema}/stats
//                          returns { templates: N, assets: N, burned_assets: N }
//   template count       → summed from per-schema stats (exact)
//
// We do NOT fetch assets?... with limit=1000 — that's a heavy list-fetch that
// times out on large collections and gives wrong counts.

import { NextRequest, NextResponse } from 'next/server';
import { buildCacheKey, cacheGet, cacheSet } from '@/lib/cache';
import { pickEndpoint } from '@/lib/endpoint-pool';
import {
  analyzeOwnership,
  analyzeSchemasAndTemplates,
  analyzeMintedAssets,
} from '@/lib/analyzers/collection';
import type { CollectionMeta, SchemaInfo } from '@/lib/analyzers/collection';
import type { AnalyzerResult } from '@/lib/analyzers/types';

export const runtime = 'nodejs';
const COLLECTION_TTL = 60; // seconds

// ── Debug source tracking ─────────────────────────────────────────────────────

interface DebugSource {
  url: string;
  status: 'ok' | 'failed';
  result: string;
}

// ── AtomicAssets fetch helper ─────────────────────────────────────────────────

async function fetchAA<T>(
  ep: string,
  path: string,
  sources: DebugSource[],
): Promise<T | null> {
  const url = `${ep}/atomicassets/v1/${path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      sources.push({ url, status: 'failed', result: `HTTP ${res.status}` });
      return null;
    }
    const json = await res.json() as { success: boolean; data?: T };
    if (!json.success || json.data == null) {
      sources.push({ url, status: 'failed', result: 'success=false or empty data' });
      return null;
    }
    sources.push({ url, status: 'ok', result: Array.isArray(json.data) ? `${(json.data as unknown[]).length} items` : 'object' });
    return json.data;
  } catch (e) {
    sources.push({ url, status: 'failed', result: String(e) });
    return null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CollectionStats {
  assets: number;
  burned_assets: number;
}

interface SchemaStats {
  templates: number;
  assets: number;
  burned_assets: number;
}

export interface SchemaWithStats extends SchemaInfo {
  templateCount: number | null;
  assetCount: number | null;
}

export async function GET(req: NextRequest) {
  const name    = req.nextUrl.searchParams.get('name');
  const account = req.nextUrl.searchParams.get('account') ?? '';
  const refresh = req.nextUrl.searchParams.get('refresh') === 'true';

  if (!name || name === 'undefined') {
    return NextResponse.json(
      { success: false, error: 'Collection name is required and must not be "undefined".' },
      { status: 400 },
    );
  }

  const cacheKey = buildCacheKey('chain:collection:v2', { name, account });

  if (!refresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) return NextResponse.json({ success: true, data: cached, cached: true });
  }

  const ep = pickEndpoint();
  const sources: DebugSource[] = [];

  // ── Step 1: Collection record (required) ────────────────────────────────────
  const collectionRaw = await fetchAA<CollectionMeta>(
    ep,
    `collections/${encodeURIComponent(name)}`,
    sources,
  );

  if (!collectionRaw) {
    return NextResponse.json(
      {
        success: false,
        error: `Collection "${name}" not found or AtomicAssets is unavailable.`,
        sources,
      },
      { status: 404 },
    );
  }

  // ── Step 2: Collection stats (exact asset count) ─────────────────────────────
  const collectionStats = await fetchAA<CollectionStats>(
    ep,
    `collections/${encodeURIComponent(name)}/stats`,
    sources,
  );

  // ── Step 3: Schema list ──────────────────────────────────────────────────────
  const schemasRaw = await fetchAA<SchemaInfo[]>(
    ep,
    `schemas?collection_name=${encodeURIComponent(name)}&limit=100&page=1`,
    sources,
  );

  const schemas = schemasRaw ?? [];

  // ── Step 4: Per-schema stats (template + asset counts) ──────────────────────
  // Run in parallel — gives exact template count per schema/category
  const schemaStatsList: Array<SchemaStats | null> = schemas.length > 0
    ? await Promise.all(
        schemas.map(s =>
          fetchAA<SchemaStats>(
            ep,
            `schemas/${encodeURIComponent(name)}/${encodeURIComponent(s.schema_name)}/stats`,
            sources,
          ),
        ),
      )
    : [];

  // ── Step 5: Assemble schemas with stats ─────────────────────────────────────
  const schemasWithStats: SchemaWithStats[] = schemas.map((s, i) => ({
    ...s,
    templateCount: schemaStatsList[i]?.templates ?? null,
    assetCount:    schemaStatsList[i]?.assets    ?? null,
  }));

  const schemaCount = schemas.length > 0 ? schemas.length : null; // null = fetch failed

  // Template count = sum of per-schema template counts (exact if all stats fetched)
  const templateCounts = schemaStatsList.filter(Boolean).map(s => s!.templates);
  const templateCount = templateCounts.length > 0
    ? templateCounts.reduce((s, n) => s + n, 0)
    : null;

  // Asset count from collection stats (exact)
  const assetCount = collectionStats?.assets ?? null;
  const burnedCount = collectionStats?.burned_assets ?? null;

  // ── Step 6: Run analyzers ────────────────────────────────────────────────────
  const results: AnalyzerResult[] = [];

  const ownershipResult = analyzeOwnership(collectionRaw, account);
  const role = ownershipResult.role;
  results.push(ownershipResult);

  results.push(
    analyzeSchemasAndTemplates(
      schemasWithStats as SchemaInfo[],
      [],                      // don't pass individual template objects; use counts
      schemaCount ?? 0,
      templateCount ?? 0,
      role,
    ),
  );

  results.push(
    analyzeMintedAssets(name, {
      totalInCollection: assetCount ?? 0,
      mintedByAccount: null,   // not fetched on collection page (no heavy query)
      canDetermineRamPayer: false,
    }, role),
  );

  const payload = {
    collection:    collectionRaw,
    stats: {
      assets:        assetCount,
      burned_assets: burnedCount,
    },
    schemas:       schemasWithStats,
    schemaCount,
    templateCount,
    assetCount,
    account:       account || null,
    role,
    analyzers:     results,
    sources,
    endpoint:      ep,
  };

  await cacheSet(cacheKey, payload, COLLECTION_TTL);
  return NextResponse.json({ success: true, data: payload, cached: false });
}
