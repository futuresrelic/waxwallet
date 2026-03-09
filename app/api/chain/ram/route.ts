// ─── WAX Chain: RAM analyzer orchestrator ────────────────────────────────────
// Runs all RAM table analyzers server-side and returns structured results.
// The RAM analyzers call WAX RPC directly (not through another API route).

import { NextRequest, NextResponse } from 'next/server';
import { buildCacheKey, cacheGet, cacheSet } from '@/lib/cache';
import type { TableQueryFn } from '@/lib/analyzers/types';
import { runAllRamAnalyzers } from '@/lib/analyzers/ram/index';

export const runtime = 'nodejs';

const WAX_RPC  = 'https://wax.greymass.com';
const RAM_TTL  = 30; // seconds

/** Direct WAX RPC table query — used only from this server-side route. */
const queryTable: TableQueryFn = async (params) => {
  const body = {
    json:           true,
    code:           params.code,
    scope:          params.scope,
    table:          params.table,
    lower_bound:    params.lower_bound ?? '',
    upper_bound:    params.upper_bound ?? '',
    limit:          params.limit ?? 100,
    index_position: params.index_position ?? 'primary',
    key_type:       params.key_type ?? '',
  };

  const res = await fetch(`${WAX_RPC}/v1/chain/get_table_rows`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${params.code}::${params.table}`);
  const json = await res.json() as { rows?: unknown[] };
  return json.rows ?? [];
};

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get('account');
  const refresh  = req.nextUrl.searchParams.get('refresh') === 'true';

  if (!account) {
    return NextResponse.json({ success: false, error: 'account is required' }, { status: 400 });
  }

  const cacheKey = buildCacheKey('chain:ram', { account });

  if (!refresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true });
    }
  }

  try {
    const results = await runAllRamAnalyzers(account, queryTable);
    await cacheSet(cacheKey, results, RAM_TTL);
    return NextResponse.json({ success: true, data: results, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[chain/ram]', account, message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
