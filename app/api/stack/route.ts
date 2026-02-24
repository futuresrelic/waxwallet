// ─── GET /api/stack ───────────────────────────────────────────────────────────
// Server-side template aggregation: fetches up to 2000 assets for a wallet,
// groups them by template_id, sorts, and paginates.
//
// Query params:
//   owner           required
//   collection_name optional  comma-separated (passed through to AtomicAssets)
//   schema_name     optional  comma-separated
//   sort            optional  count:desc | count:asc | name:asc | name:desc |
//                             template_id:asc | template_id:desc  (default: count:desc)
//   page            optional  default 1
//   limit           optional  default 20, max 50

import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/api/atomicassets';
import { getAssetMedia, getAssetName, type AssetData, type TemplateStack, type StackMeta } from '@/lib/types';

export const runtime = 'nodejs';

// Fetch up to 2 pages × 1000 assets = 2000 per aggregation call.
const BATCH_SIZE = 1000;
const MAX_ASSETS = 2000;

async function collectAssets(params: {
  owner: string;
  collection_name?: string;
  schema_name?: string;
}): Promise<{ assets: AssetData[]; capped: boolean }> {
  const all: AssetData[] = [];
  let capped = false;

  for (let page = 1; page <= 2; page++) {
    const batch = await getAssets({
      owner: params.owner,
      collection_name: params.collection_name,
      schema_name: params.schema_name,
      sort: 'asset_id:asc',
      page,
      limit: BATCH_SIZE,
      _uncapped: true,
    });
    all.push(...batch);
    if (batch.length < BATCH_SIZE) break; // no more pages
    if (all.length >= MAX_ASSETS) {
      capped = true;
      break;
    }
  }

  return { assets: all.slice(0, MAX_ASSETS), capped };
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

  try {
    const { assets, capped } = await collectAssets({
      owner,
      collection_name: collectionName,
      schema_name: schemaName,
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
