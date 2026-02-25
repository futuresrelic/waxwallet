import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/api/atomicassets';
import { buildCacheKey, cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache';
import type { AssetData } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const owner = searchParams.get('owner');
  if (!owner) {
    return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  }

  const collection_name = searchParams.get('collection_name') ?? undefined;
  const schema_name     = searchParams.get('schema_name') ?? undefined;
  const template_id     = searchParams.get('template_id') ?? undefined;
  const match           = searchParams.get('match') ?? undefined;
  const sort            = searchParams.get('sort') ?? 'asset_id:desc';
  const page            = Number(searchParams.get('page') ?? 1);
  const limit           = Number(searchParams.get('limit') ?? 40);
  const burned          = searchParams.get('burned') === 'true';
  const attr_rarity     = searchParams.get('attr_rarity') ?? undefined;

  // Generic attribute filters (a.key=value)
  const attrFilters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('a.') && value) attrFilters[key.slice(2)] = value;
  }

  const refresh = searchParams.get('refresh') === 'true';

  const cacheKey = buildCacheKey('assets', {
    owner, collection_name, schema_name, template_id, match,
    sort, page, limit, burned, attr_rarity,
    ...Object.fromEntries(Object.entries(attrFilters).map(([k, v]) => [`a.${k}`, v])),
  });

  if (!refresh) {
    const cached = await cacheGet<AssetData[]>(cacheKey);
    if (cached) {
      return NextResponse.json(
        { success: true, data: cached },
        { headers: { 'Cache-Control': 's-maxage=15, stale-while-revalidate=30', 'X-Cache': 'HIT' } },
      );
    }
  }

  try {
    const assets = await getAssets({
      owner, collection_name, schema_name, template_id, match,
      sort, page, limit, burned, attr_rarity, attr_filters: attrFilters,
    });

    await cacheSet(cacheKey, assets, CACHE_TTL);

    return NextResponse.json(
      { success: true, data: assets },
      { headers: { 'Cache-Control': 's-maxage=15, stale-while-revalidate=30' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /assets] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
