import { NextRequest, NextResponse } from 'next/server';
import { getAsset } from '@/lib/api/atomicassets';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;

  try {
    const asset = await getAsset(assetId);
    return NextResponse.json(
      { success: true, data: asset },
      {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[API /asset/${assetId}] error:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
