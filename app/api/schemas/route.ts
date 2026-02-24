import { NextRequest, NextResponse } from 'next/server';
import { getSchemas } from '@/lib/api/atomicassets';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const collection = req.nextUrl.searchParams.get('collection_name');
  if (!collection) {
    return NextResponse.json({ error: 'collection_name is required' }, { status: 400 });
  }

  try {
    const schemas = await getSchemas(collection);
    return NextResponse.json(
      { success: true, data: schemas },
      {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message, data: [] }, { status: 200 });
  }
}
