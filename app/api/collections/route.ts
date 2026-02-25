import { NextRequest, NextResponse } from 'next/server';
import { getAccountSummary } from '@/lib/api/atomicassets';
import { buildCacheKey, cacheGet, cacheSet } from '@/lib/cache';
import { pickEndpoint } from '@/lib/endpoint-pool';

export const runtime = 'nodejs';

// Account collections change when assets are received/sent but are stable
// within a session — 60 s TTL is a good balance.
const COLLECTIONS_TTL = 60; // seconds

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const owner = searchParams.get('owner');
  if (!owner) {
    return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  }

  const refresh = searchParams.get('refresh') === 'true';
  const cacheKey = buildCacheKey('collections', { owner });
  const endpoint = pickEndpoint();

  if (!refresh) {
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(
        { success: true, data: cached },
        { headers: {
            'Cache-Control': `s-maxage=${COLLECTIONS_TTL}, stale-while-revalidate=120`,
            'X-Cache': 'HIT',
            'X-Atomic-Endpoint': endpoint,
          },
        },
      );
    }
  }

  try {
    const summary = await getAccountSummary(owner);
    await cacheSet(cacheKey, summary, COLLECTIONS_TTL);
    return NextResponse.json(
      { success: true, data: summary },
      { headers: {
          'Cache-Control': `s-maxage=${COLLECTIONS_TTL}, stale-while-revalidate=120`,
          'X-Cache': 'MISS',
          'X-Atomic-Endpoint': endpoint,
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /collections] error:', message);
    return NextResponse.json(
      { success: false, error: message, data: { collections: [] } },
      { status: 200 },
    );
  }
}
