// ─── GET /api/stack ───────────────────────────────────────────────────────────
// Server-side template aggregation: fetches all assets for a wallet (up to
// MAX_ASSETS), groups them by template_id, sorts, and paginates.
//
// Query params:
//   owner           required
//   collection_name optional  comma-separated (passed through to AtomicAssets)
//   schema_name     optional  comma-separated
//   sort            optional  count:desc | count:asc | name:asc | name:desc |
//                             template_id:asc | template_id:desc  (default: count:desc)
//   page            optional  default 1
//   limit           optional  default 20, max 50
//   scan_pages      optional  1-10, each page = 1000 assets (default 3 = fast 3000-asset scan)
//                             When scan_pages >= 10, the full scan runs in the background
//                             and partial results are returned immediately with meta.indexing=true.
//   refresh         optional  bypass cache and re-scan

import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/api/atomicassets';
import { getAssetMedia, getAssetName, type AssetData, type TemplateStack, type StackMeta } from '@/lib/types';
import { buildCacheKey, cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache';
import { isIndexing, startIndexJob } from '@/lib/index-jobs';

export const runtime = 'nodejs';

// Fetch pages in parallel batches to reduce wall-clock time for large wallets.
const BATCH_SIZE = 1000;
const MAX_ASSETS = 10_000; // safety ceiling; show capped warning above this
const PARALLEL = 3;        // pages fetched simultaneously per round
const FAST_SCAN_PAGES = 3; // default fast-scan (3 000 assets)

async function collectAssets(params: {
  owner: string;
  collection_name?: string;
  schema_name?: string;
  maxAssets: number;
}): Promise<{ assets: AssetData[]; capped: boolean; scanComplete: boolean }> {
  const all: AssetData[] = [];
  let page = 1;

  while (true) {
    const remaining = params.maxAssets - all.length;
    if (remaining <= 0) return { assets: all, capped: all.length >= MAX_ASSETS, scanComplete: false };

    const pagesThisRound = Math.min(PARALLEL, Math.ceil(remaining / BATCH_SIZE));

    const results = await Promise.all(
      Array.from({ length: pagesThisRound }, (_, i) =>
        getAssets({
          owner: params.owner,
          collection_name: params.collection_name,
          schema_name: params.schema_name,
          sort: 'asset_id:asc',
          page: page + i,
          limit: BATCH_SIZE,
          _uncapped: true,
        }),
      ),
    );

    let exhausted = false;
    for (const batch of results) {
      all.push(...batch);
      if (batch.length < BATCH_SIZE) { exhausted = true; break; }
      if (all.length >= params.maxAssets) {
        return {
          assets: all.slice(0, params.maxAssets),
          capped: all.length >= MAX_ASSETS,
          scanComplete: false,
        };
      }
    }

    if (exhausted) break;
    page += pagesThisRound;
  }

  return { assets: all, capped: false, scanComplete: true };
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

interface AggResult {
  stacks: TemplateStack[];
  capped: boolean;
  scanComplete: boolean;
  totalFetched: number;
  noTemplateCount: number;
}

async function buildAggregation(
  owner: string,
  collectionName: string | undefined,
  schemaName: string | undefined,
  sortKey: string,
  maxAssets: number,
): Promise<AggResult> {
  const { assets, capped, scanComplete } = await collectAssets({
    owner,
    collection_name: collectionName,
    schema_name: schemaName,
    maxAssets,
  });

  const templateMap = new Map<string, TemplateStack>();
  let noTemplateCount = 0;

  for (const asset of assets) {
    if (!asset.template?.template_id) { noTemplateCount++; continue; }
    const tid = asset.template.template_id;
    if (!templateMap.has(tid)) {
      const { url, type } = getAssetMedia(asset);
      templateMap.set(tid, {
        template_id: tid,
        name: getAssetName(asset),
        collection_name: asset.collection.collection_name,
        collection_display_name: asset.collection.name || asset.collection.collection_name,
        schema_name: asset.schema.schema_name,
        image_url: url,
        image_type: type,
        count: 0,
        max_supply: asset.template.max_supply,
        issued_supply: asset.template.issued_supply,
        sample_asset_ids: [],
      });
    }
    const entry = templateMap.get(tid)!;
    entry.count++;
    if (entry.sample_asset_ids.length < 5) entry.sample_asset_ids.push(asset.asset_id);
  }

  const [sortField, sortDir] = sortKey.split(':');
  const stacks = Array.from(templateMap.values()).sort((a, b) => {
    let cmp = 0;
    if (sortField === 'count') cmp = a.count - b.count;
    else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'template_id') cmp = Number(a.template_id) - Number(b.template_id);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return { stacks, capped, scanComplete, totalFetched: assets.length, noTemplateCount };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const owner = searchParams.get('owner');
  if (!owner) {
    return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  }

  const collectionName = searchParams.get('collection_name') ?? undefined;
  const schemaName = searchParams.get('schema_name') ?? undefined;
  const match = searchParams.get('match')?.trim() || undefined;
  const sort = searchParams.get('sort') ?? 'count:desc';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const refresh = searchParams.get('refresh') === 'true';

  // scan_pages controls how many 1000-asset batches to scan.
  const scanPages = Math.min(10, Math.max(1, Number(searchParams.get('scan_pages') ?? FAST_SCAN_PAGES)));
  const maxAssets = Math.min(MAX_ASSETS, scanPages * BATCH_SIZE);
  const isFullScan = scanPages >= 10;

  // Cache key covers the full sorted template list for this query shape
  const aggCacheKey = buildCacheKey('stack', {
    owner,
    collection_name: collectionName,
    schema_name: schemaName,
    sort,
    scan_pages: scanPages,
  });

  // Fast-scan cache key (always available as partial data fallback)
  const fastCacheKey = buildCacheKey('stack', {
    owner,
    collection_name: collectionName,
    schema_name: schemaName,
    sort,
    scan_pages: FAST_SCAN_PAGES,
  });

  try {
    // ── Cache read ────────────────────────────────────────────────────────────
    let agg: AggResult | null = null;

    if (!refresh) {
      agg = await cacheGet<AggResult>(aggCacheKey);
    }

    // ── Cache miss handling ───────────────────────────────────────────────────
    if (!agg) {
      if (isFullScan) {
        // Background mode: fire-and-forget full scan, return partial data immediately.
        // This prevents the client from blocking for 10+ seconds on large wallets.
        if (!isIndexing(aggCacheKey)) {
          startIndexJob(aggCacheKey, async () => {
            const result = await buildAggregation(owner, collectionName, schemaName, sort, maxAssets);
            await cacheSet(aggCacheKey, result, CACHE_TTL);
          });
        }

        // Try to return fast-scan partial data while the background job runs.
        // If fast-scan is also uncached, perform it inline (quick: 3 pages = ~3s).
        let partial = await cacheGet<AggResult>(fastCacheKey);
        if (!partial) {
          partial = await buildAggregation(
            owner, collectionName, schemaName, sort, FAST_SCAN_PAGES * BATCH_SIZE,
          );
          await cacheSet(fastCacheKey, partial, CACHE_TTL);
        }

        const { stacks: rawStacks, capped, scanComplete, totalFetched, noTemplateCount } = partial;
        const matchLow = match?.toLowerCase();
        const stacks = matchLow ? rawStacks.filter(s => s.name.toLowerCase().includes(matchLow)) : rawStacks;
        const total = stacks.length;
        const start = (page - 1) * limit;
        const pageData = stacks.slice(start, start + limit);

        const meta: StackMeta = {
          total,
          page,
          limit,
          capped,
          scanComplete,
          totalFetched,
          noTemplateCount,
          indexing: true, // tells the client to poll
        };

        return NextResponse.json(
          { success: true, data: pageData, meta },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      // Normal (fast) blocking scan
      agg = await buildAggregation(owner, collectionName, schemaName, sort, maxAssets);
      await cacheSet(aggCacheKey, agg, CACHE_TTL);
    }

    // ── Paginate from cached sorted list (with optional name filter) ──────────
    const { stacks: rawStacks, capped, scanComplete, totalFetched, noTemplateCount } = agg;
    const matchLow = match?.toLowerCase();
    const stacks = matchLow ? rawStacks.filter(s => s.name.toLowerCase().includes(matchLow)) : rawStacks;
    const total = stacks.length;
    const start = (page - 1) * limit;
    const pageData = stacks.slice(start, start + limit);

    // Still indexing if the background job is running (e.g. user refreshed before done)
    const stillIndexing = isFullScan && isIndexing(aggCacheKey);

    const meta: StackMeta = {
      total,
      page,
      limit,
      capped,
      scanComplete,
      totalFetched,
      noTemplateCount,
      indexing: stillIndexing || undefined,
    };

    return NextResponse.json(
      { success: true, data: pageData, meta },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /stack] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
