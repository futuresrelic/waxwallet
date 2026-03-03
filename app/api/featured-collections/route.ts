// GET /api/featured-collections
// Public endpoint — returns the admin-curated list of featured WAX collections.
// Used by the leaderboard page to show collection quick-pick chips.

import { NextResponse } from 'next/server';
import { getStoredConfig } from '@/lib/config-store';

export const runtime = 'nodejs';

export async function GET() {
  const { featuredCollections = [] } = getStoredConfig();
  return NextResponse.json({ success: true, data: featuredCollections });
}
