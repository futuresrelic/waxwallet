// ─── GET /api/leaderboard ──────────────────────────────────────────────────────
// Returns the top WAX NFT holders from AtomicAssets.
//
// Query params:
//   collection_name  optional  filter to a specific collection
//   limit            optional  10–100, default 50
//   userEndpoint     optional  user-selected AtomicAssets endpoint URL
//   refresh          optional  bypass cache

import { NextRequest, NextResponse } from 'next/server';
import { buildCacheKey, cacheGet, cacheSet } from '@/lib/cache';
import { pickEndpoint, resolveUserEndpoint } from '@/lib/endpoint-pool';

export const runtime = 'nodejs';

const LEADERBOARD_TTL = 300; // 5 minutes

export interface LeaderboardEntry {
  rank: number;
  account: string;
  assets: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const collectionName = searchParams.get('collection_name')?.trim() || undefined;
  const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 50)));
  const refresh = searchParams.get('refresh') === 'true';
  const userEndpoint = resolveUserEndpoint(searchParams.get('userEndpoint'));

  const cacheKey = buildCacheKey('leaderboard', {
    collection_name: collectionName,
    limit,
    ...(userEndpoint ? { _ep: userEndpoint } : {}),
  });

  if (!refresh) {
    const cached = await cacheGet<LeaderboardEntry[]>(cacheKey);
    if (cached) {
      return NextResponse.json(
        { success: true, data: cached },
        { headers: { 'Cache-Control': `s-maxage=${LEADERBOARD_TTL}`, 'X-Cache': 'HIT' } },
      );
    }
  }

  const base = userEndpoint ?? pickEndpoint();
  const params = new URLSearchParams({
    order: 'desc',
    sort: 'assets',
    limit: String(limit),
  });
  if (collectionName) params.set('collection_name', collectionName);

  try {
    const res = await fetch(`${base}/atomicassets/v1/accounts?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`AtomicAssets API error: ${res.status} ${res.statusText}`);

    const json = await res.json() as { success: boolean; data?: Array<{ account: string; assets: number }> };
    if (!json.success || !Array.isArray(json.data)) {
      throw new Error('Unexpected API response shape');
    }

    const data: LeaderboardEntry[] = json.data.map((entry, i) => ({
      rank: i + 1,
      account: entry.account,
      assets: Number(entry.assets),
    }));

    await cacheSet(cacheKey, data, LEADERBOARD_TTL);

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': `s-maxage=${LEADERBOARD_TTL}`, 'X-Cache': 'MISS' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /leaderboard] error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
