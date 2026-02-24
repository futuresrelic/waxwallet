// ─── Public: Template Links ───────────────────────────────────────────────────
// Returns all *enabled* template links. No auth required.
// Used by the wallet page to decorate asset/template cards.

import { NextResponse } from 'next/server';
import { getAllLinks } from '@/lib/template-links-store';

export const runtime = 'nodejs';

export async function GET() {
  const enabled = getAllLinks().filter((l) => l.enabled);
  return NextResponse.json(
    { success: true, data: enabled },
    { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
  );
}
