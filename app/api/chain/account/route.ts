// ─── WAX Chain: get_account proxy ────────────────────────────────────────────
// Proxies EOSIO get_account with a very short TTL so resource data stays fresh.

import { NextRequest, NextResponse } from 'next/server';
import { buildCacheKey, cacheGet, cacheSet } from '@/lib/cache';

export const runtime = 'nodejs';

const WAX_RPC = 'https://wax.greymass.com';
const ACCOUNT_TTL = 5; // seconds — resource limits window-refill every ~24h but PowerUps apply instantly

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get('account');
  if (!account) {
    return NextResponse.json({ success: false, error: 'account is required' }, { status: 400 });
  }

  const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
  const cacheKey = buildCacheKey('chain:account', { account });

  if (!refresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true });
    }
  }

  try {
    const res = await fetch(`${WAX_RPC}/v1/chain/get_account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_name: account }),
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 500) {
      // EOSIO returns 500 for unknown accounts
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: { what?: string } }).error?.what ?? 'Account not found';
      return NextResponse.json({ success: false, error: msg }, { status: 404 });
    }

    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);

    const data = await res.json();
    await cacheSet(cacheKey, data, ACCOUNT_TTL);
    return NextResponse.json({ success: true, data, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[chain/account]', account, message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
