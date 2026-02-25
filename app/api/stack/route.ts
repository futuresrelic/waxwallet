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
//   match           optional  filter template names (and template_id) by substring
//   a.{key}         optional  attribute filter — template must have key=value
//                             (AND semantics across multiple a.* params)

import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/api/atomicassets';
import { getAssetMedia, getAssetName, type AssetData, type TemplateStack, type StackMeta } from '@/lib/types';
import { buildCacheKey, cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache';
import { isIndexing, startIndexJob } from '@/lib/index-jobs';
import { pickEndpoint } from '@/lib/endpoint-pool';

export const runtime = 'nodejs';

// Aggregation cache TTL: 5 minutes — template stacks are aggregate data
// (not individual ownership) and are expensive to recompute for large wallets.
// Users can force a fresh fetch via the "Refresh" button (refresh=true).
const STACK_AGG_TTL = 300; // seconds

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
  /**
   * Per-template attribute values indexed during aggregation.
   * Used for post-cache attribute filtering so the aggregation cache can be
   * shared across different attribute filter combinations.
   * Shape: template_id → { field → [value, …] }
   */
  templateAttrs: Record<string, Record<string, string[]>>;
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
  const templateAttrs: Record<string, Record<string, string[]>> = {};
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

      // Index template-level attribute values once per unique template_id.
      // Uses template.immutable_data (same for all copies) merged with asset.immutable_data
      // so facet-panel attribute values align with what the user sees in filters.
      const attrSource: Record<string, unknown> = {
        ...asset.template.immutable_data,
        ...asset.immutable_data,
      };
      const attrEntry: Record<string, string[]> = {};
      for (const [key, val] of Object.entries(attrSource)) {
        if (val === null || val === undefined || typeof val === 'boolean') continue;
        const strVal = String(val);
        if (strVal && strVal !== 'undefined') attrEntry[key] = [strVal];
      }
      templateAttrs[tid] = attrEntry;
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

  return { stacks, templateAttrs, capped, scanComplete, totalFetched: assets.length, noTemplateCount };
}

// ─── Post-cache filter helper ─────────────────────────────────────────────────

/**
 * Apply attribute and name/id filters to a sorted stacks array.
 * Attribute filtering uses the indexed templateAttrs map (built during aggregation).
 * Match filters by template name OR template_id substring.
 * Both filters are applied before pagination.
 */
function filterStacks(
  rawStacks: TemplateStack[],
  templateAttrs: Record<string, Record<string, string[]>>,
  attrFilters: Record<string, string>,
  match: string | undefined,
): TemplateStack[] {
  let stacks = rawStacks;

  // Attribute filter: template must have ALL specified key=value pairs (AND semantics)
  if (Object.keys(attrFilters).length > 0) {
    stacks = stacks.filter((s) => {
      const attrs = templateAttrs[s.template_id] ?? {};
      return Object.entries(attrFilters).every(([key, val]) => {
        const values = attrs[key];
        return Array.isArray(values) && values.includes(val);
      });
    });
  }

  // Match filter: template name or template_id contains the search string
  if (match) {
    const matchLow = match.toLowerCase();
    stacks = stacks.filter(
      (s) => s.name.toLowerCase().includes(matchLow) || s.template_id.includes(match),
    );
  }

  return stacks;
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

  // Attribute filters: a.{key}=value params (AND semantics, applied post-cache)
  const attrFilters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('a.') && value) attrFilters[key.slice(2)] = value;
  }

  // scan_pages controls how many 1000-asset batches to scan.
  const scanPages = Math.min(10, Math.max(1, Number(searchParams.get('scan_pages') ?? FAST_SCAN_PAGES)));
  const maxAssets = Math.min(MAX_ASSETS, scanPages * BATCH_SIZE);
  const isFullScan = scanPages >= 10;

  // Cache key covers the full sorted template list for this query shape.
  // Attribute filters are intentionally excluded from the key — they are applied
  // post-cache so the same aggregation is reused across different attribute combos.
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
    let aggFromCache = false;

    if (!refresh) {
      agg = await cacheGet<AggResult>(aggCacheKey);
      aggFromCache = agg !== null;
    }

    // ── Cache miss handling ───────────────────────────────────────────────────
    if (!agg) {
      if (isFullScan) {
        // Background mode: fire-and-forget full scan, return partial data immediately.
        // This prevents the client from blocking for 10+ seconds on large wallets.
        if (!isIndexing(aggCacheKey)) {
          startIndexJob(aggCacheKey, async () => {
            const result = await buildAggregation(owner, collectionName, schemaName, sort, maxAssets);
            await cacheSet(aggCacheKey, result, STACK_AGG_TTL);
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

        const { stacks: rawStacks, templateAttrs: partialAttrs, capped, scanComplete, totalFetched, noTemplateCount } = partial;
        const stacks = filterStacks(rawStacks, partialAttrs ?? {}, attrFilters, match);
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

        const endpoint = pickEndpoint();
        return NextResponse.json(
          { success: true, data: pageData, meta },
          { headers: {
              'Cache-Control': 'no-store',
              'X-Cache': 'MISS',
              'X-Atomic-Endpoint': endpoint,
            },
          },
        );
      }

      // Normal (fast) blocking scan
      agg = await buildAggregation(owner, collectionName, schemaName, sort, maxAssets);
      await cacheSet(aggCacheKey, agg, STACK_AGG_TTL);
    }

    // ── Paginate from cached sorted list (with attribute + name filters) ──────
    const { stacks: rawStacks, templateAttrs: cachedAttrs, capped, scanComplete, totalFetched, noTemplateCount } = agg;
    // Guard: old cache entries (written before templateAttrs was added) won't have the field
    const stacks = filterStacks(rawStacks, cachedAttrs ?? {}, attrFilters, match);
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

    const endpoint = pickEndpoint();
    return NextResponse.json(
      { success: true, data: pageData, meta },
      { headers: {
          'Cache-Control': `s-maxage=${STACK_AGG_TTL}, stale-while-revalidate=${STACK_AGG_TTL * 2}`,
          'X-Cache': aggFromCache ? 'HIT' : 'MISS',
          'X-Atomic-Endpoint': endpoint,
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /stack] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
