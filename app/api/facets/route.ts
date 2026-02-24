// ─── Public: Facets ───────────────────────────────────────────────────────────
// Scans up to 2000 assets and returns attribute facet counts (rarity, etc.)
// Used by the wallet page to show rarity filter values with counts.

import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/api/atomicassets';

export const runtime = 'nodejs';

const BATCH_SIZE = 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const owner = searchParams.get('owner');
  if (!owner) {
    return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  }

  const collection_name = searchParams.get('collection_name') ?? undefined;
  const schema_name = searchParams.get('schema_name') ?? undefined;

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
      getAssets({ ...baseQuery, page: 1 }),
      getAssets({ ...baseQuery, page: 2 }),
    ]);

    const all = [...batch1, ...batch2];
    const scanned = all.length;
    // capped = true if both batches were full (more assets may exist beyond scan window)
    const capped = batch1.length === BATCH_SIZE && batch2.length === BATCH_SIZE;

    // Count rarity values across all scanned assets
    const rarity: Record<string, number> = {};
    for (const asset of all) {
      const data = {
        ...asset.template?.immutable_data,
        ...asset.immutable_data,
        ...asset.mutable_data,
        ...asset.data,
      };
      const r = data.rarity;
      if (r && typeof r === 'string') {
        rarity[r] = (rarity[r] ?? 0) + 1;
      }
    }

    return NextResponse.json(
      { success: true, data: { rarity, scanned, capped } },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /facets] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
