import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/api/atomicassets';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const owner = searchParams.get('owner');
  if (!owner) {
    return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  }

  try {
    const assets = await getAssets({
      owner,
      collection_name: searchParams.get('collection_name') ?? undefined,
      schema_name: searchParams.get('schema_name') ?? undefined,
      template_id: searchParams.get('template_id') ?? undefined,
      match: searchParams.get('match') ?? undefined,
      sort: searchParams.get('sort') ?? 'asset_id:desc',
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 40),
      burned: searchParams.get('burned') === 'true',
      attr_rarity: searchParams.get('attr_rarity') ?? undefined,
    });

    return NextResponse.json(
      { success: true, data: assets },
      {
        headers: {
          'Cache-Control': 's-maxage=15, stale-while-revalidate=30',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /assets] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
