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
//                             Higher values trade latency for completeness.

import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/api/atomicassets';
import { getAssetMedia, getAssetName, type AssetData, type TemplateStack, type StackMeta } from '@/lib/types';

export const runtime = 'nodejs';

// Fetch pages in parallel batches to reduce wall-clock time for large wallets.
const BATCH_SIZE = 1000;
const MAX_ASSETS = 10_000; // safety ceiling; show capped warning above this
const PARALLEL = 3;        // pages fetched simultaneously per round

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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const owner = searchParams.get('owner');
  if (!owner) {
    return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  }

  const collectionName = searchParams.get('collection_name') ?? undefined;
  const schemaName = searchParams.get('schema_name') ?? undefined;
  const sort = searchParams.get('sort') ?? 'count:desc';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));

  // scan_pages controls how many 1000-asset batches to scan.
  // Default 3 (3000 assets) for fast initial loads; up to 10 (10k assets = MAX_ASSETS).
  const scanPages = Math.min(10, Math.max(1, Number(searchParams.get('scan_pages') ?? 3)));
  const maxAssets = Math.min(MAX_ASSETS, scanPages * BATCH_SIZE);

  try {
    const { assets, capped, scanComplete } = await collectAssets({
      owner,
      collection_name: collectionName,
      schema_name: schemaName,
      maxAssets,
    });

    // ── Aggregate by template_id ──────────────────────────────────────────────
    const templateMap = new Map<string, TemplateStack>();
    let noTemplateCount = 0;

    for (const asset of assets) {
      if (!asset.template?.template_id) {
        noTemplateCount++;
        continue;
      }

      const tid = asset.template.template_id;

      if (!templateMap.has(tid)) {
        const { url, type } = getAssetMedia(asset);
        const name = getAssetName(asset);
        templateMap.set(tid, {
          template_id: tid,
          name,
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

    // ── Sort ──────────────────────────────────────────────────────────────────
    const [sortField, sortDir] = sort.split(':');
    const stacks = Array.from(templateMap.values()).sort((a, b) => {
      let cmp = 0;
      if (sortField === 'count') cmp = a.count - b.count;
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'template_id') cmp = Number(a.template_id) - Number(b.template_id);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    // ── Paginate ──────────────────────────────────────────────────────────────
    const total = stacks.length;
    const start = (page - 1) * limit;
    const pageData = stacks.slice(start, start + limit);

    const meta: StackMeta = {
      total,
      page,
      limit,
      capped,
      scanComplete,
      totalFetched: assets.length,
      noTemplateCount,
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
