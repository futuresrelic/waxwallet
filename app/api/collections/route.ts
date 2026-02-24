import { NextRequest, NextResponse } from 'next/server';
import { getAccountSummary } from '@/lib/api/atomicassets';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get('owner');
  if (!owner) {
    return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  }

  try {
    const summary = await getAccountSummary(owner);
    return NextResponse.json(
      { success: true, data: summary },
      {
        headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message, data: { collections: [] } }, { status: 200 });
  }
}
