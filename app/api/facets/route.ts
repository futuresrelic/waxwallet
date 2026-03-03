// ─── Public: Facets ───────────────────────────────────────────────────────────
// Scans up to 2000 assets and returns dynamic attribute facet counts.
//
// Attribute discovery rules:
//   - Only string-type values are considered
//   - Known media/URL fields are skipped (img, video, animation_url, …)
//   - Values longer than 100 chars, or IPFS/HTTP URL values, are skipped
//   - Field must appear on ≥ MIN_COVERAGE of scanned assets
//   - Field must have ≤ MAX_CARDINALITY unique values (low-cardinality = filterable)
//   - Returns top MAX_ATTRIBUTES fields ordered by total asset coverage
//
// Response: { attributes, schemas, scanned, capped }
//   attributes: Record<fieldName, Record<value, count>>
//   schemas:    Record<schemaName, count>

import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/api/atomicassets';
import { buildCacheKey, cacheGet, cacheSet } from '@/lib/cache';
import { pickEndpoint, resolveUserEndpoint } from '@/lib/endpoint-pool';

export const runtime = 'nodejs';

const BATCH_SIZE = 1000;
const FACETS_TTL = 300; // 5 minutes — attribute distribution changes slowly

// Discovery thresholds
const MAX_CARDINALITY = 20;   // max unique values per attribute to qualify
const MIN_COVERAGE   = 0.05;  // field must appear on ≥ 5% of scanned assets
const MAX_ATTRIBUTES = 8;     // return at most 8 dynamic attribute groups

// Known media / URL / metadata fields that are not useful as filters
const SKIP_FIELDS = new Set([
  'img', 'image', 'video', 'backimg_video', 'animation_url',
  'thumbnail', 'preview', 'back_img', 'backimg',
  'name', 'description', 'url', 'website',
  'youtube', 'twitter', 'telegram', 'discord',
  'cardid', 'serial', 'audio',
]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const owner = searchParams.get('owner');
  if (!owner) {
    return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  }

  const collection_name = searchParams.get('collection_name') ?? undefined;
  const schema_name = searchParams.get('schema_name') ?? undefined;
  const refresh = searchParams.get('refresh') === 'true';
  const userEndpoint = resolveUserEndpoint(searchParams.get('userEndpoint'));

  const cacheKey = buildCacheKey('facets', { owner, collection_name, schema_name, ...(userEndpoint ? { _ep: userEndpoint } : {}) });

  const endpoint = userEndpoint ?? pickEndpoint();

  if (!refresh) {
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(
        { success: true, data: cached },
        { headers: {
            'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
            'X-Cache': 'HIT',
            'X-Atomic-Endpoint': endpoint,
          },
        },
      );
    }
  }

  try {
    const baseQuery = {
      owner,
      collection_name,
      schema_name,
      sort: 'asset_id:asc',
      _uncapped: true,
      limit: BATCH_SIZE,
    } as const;

    // Fetch up to 2 batches in parallel (covers first 2000 assets)
    const [batch1, batch2] = await Promise.all([
      getAssets({ ...baseQuery, page: 1 }, userEndpoint),
      getAssets({ ...baseQuery, page: 2 }, userEndpoint),
    ]);

    const all = [...batch1, ...batch2];
    const scanned = all.length;
    // capped = true if both batches were full (more assets may exist beyond scan window)
    const capped = batch1.length === BATCH_SIZE && batch2.length === BATCH_SIZE;

    // ── Dynamic attribute discovery ──────────────────────────────────────────
    // For each field: count value occurrences and track how many assets have it.
    const attrCounts: Record<string, Record<string, number>> = {};
    const attrPresence: Record<string, number> = {};
    const schemas: Record<string, number> = {};

    for (const asset of all) {
      // Schema counts (separate concern, kept for FilterPanel schema chips)
      const s = asset.schema?.schema_name;
      if (s) schemas[s] = (schemas[s] ?? 0) + 1;

      const data = {
        ...asset.template?.immutable_data,
        ...asset.immutable_data,
        ...asset.mutable_data,
        ...asset.data,
      };

      for (const [key, val] of Object.entries(data)) {
        if (SKIP_FIELDS.has(key)) continue;
        if (typeof val !== 'string') continue;
        if (val.length > 100) continue;
        // Skip IPFS hashes and HTTP URLs — they are not filterable categories
        if (val.startsWith('Qm') || val.startsWith('bafy') || val.startsWith('http')) continue;

        attrPresence[key] = (attrPresence[key] ?? 0) + 1;
        if (!attrCounts[key]) attrCounts[key] = {};
        attrCounts[key][val] = (attrCounts[key][val] ?? 0) + 1;
      }
    }

    // Apply cardinality and coverage filters; rank by total coverage
    const attributes: Record<string, Record<string, number>> = {};
    const candidates = Object.entries(attrCounts)
      .filter(([key, valueCounts]) => {
        const uniqueValues = Object.keys(valueCounts).length;
        const coverage = (attrPresence[key] ?? 0) / scanned;
        return uniqueValues <= MAX_CARDINALITY && coverage >= MIN_COVERAGE;
      })
      .sort(([, a], [, b]) => {
        const totalA = Object.values(a).reduce((s, n) => s + n, 0);
        const totalB = Object.values(b).reduce((s, n) => s + n, 0);
        return totalB - totalA;
      })
      .slice(0, MAX_ATTRIBUTES);

    for (const [key, valueCounts] of candidates) {
      // Sort values by count descending for consistent display
      attributes[key] = Object.fromEntries(
        Object.entries(valueCounts).sort(([, a], [, b]) => b - a),
      );
    }

    const result = { attributes, schemas, scanned, capped };
    await cacheSet(cacheKey, result, FACETS_TTL);

    return NextResponse.json(
      { success: true, data: result },
      { headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
          'X-Cache': 'MISS',
          'X-Atomic-Endpoint': endpoint,
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /facets] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
