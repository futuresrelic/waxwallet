// ─── WAX Chain: Hyperion history proxy ───────────────────────────────────────
// Returns recent actions for an account using Hyperion v2 API.
// Falls back through endpoint list; returns empty gracefully on full failure.

import { NextRequest, NextResponse } from 'next/server';
import { buildCacheKey, cacheGet, cacheSet } from '@/lib/cache';

export const runtime = 'nodejs';

const HYPERION_ENDPOINTS = [
  'https://wax.eosrio.io',
  'https://hyperion.wax.eosrio.io',
  'https://api.wax.alohaeos.com',
];

const HISTORY_TTL = 30; // seconds

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get('account');
  const limit   = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 100);
  const refresh = req.nextUrl.searchParams.get('refresh') === 'true';

  if (!account) {
    return NextResponse.json({ success: false, error: 'account is required' }, { status: 400 });
  }

  const cacheKey = buildCacheKey('chain:history', { account, limit });

  if (!refresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true });
    }
  }

  for (const base of HYPERION_ENDPOINTS) {
    try {
      const url = `${base}/v2/history/get_actions`
        + `?account=${encodeURIComponent(account)}`
        + `&limit=${limit}`
        + `&skip=0`
        + `&sort=desc`
        + `&simple=false`;

      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;

      const json = await res.json() as {
        actions?: unknown[];
        total?: { value?: number };
      };

      const data = {
        actions: json.actions ?? [],
        total:   json.total?.value ?? 0,
        endpoint: base,
      };

      await cacheSet(cacheKey, data, HISTORY_TTL);
      return NextResponse.json({ success: true, data, cached: false });
    } catch {
      // try next endpoint
    }
  }

  // All endpoints failed — return empty but success so page can render partially
  return NextResponse.json({
    success: true,
    data: { actions: [], total: 0, endpoint: null },
    warning: 'History API unavailable — all Hyperion endpoints timed out or errored.',
    cached: false,
  });
}
