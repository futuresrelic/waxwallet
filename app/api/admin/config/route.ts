import { NextRequest, NextResponse } from 'next/server';
import { isValidSession, getSessionCookieName } from '@/lib/admin-auth';
import { getEndpoints, setEndpoints } from '@/lib/endpoint-pool';

export const runtime = 'nodejs';

// In-memory config for featured/blocked collections (resets on restart)
export const adminConfig = {
  featuredCollections: (process.env.FEATURED_COLLECTIONS ?? '').split(',').filter(Boolean),
  blockedCollections: (process.env.BLOCKED_COLLECTIONS ?? '').split(',').filter(Boolean),
  blockedTemplates: [] as string[],
};

function checkAuth(req: NextRequest): boolean {
  const token = req.cookies.get(getSessionCookieName())?.value;
  return isValidSession(token);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: {
      endpoints: getEndpoints(),
      ...adminConfig,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (body.endpoints && Array.isArray(body.endpoints)) {
      const urls = (body.endpoints as string[]).map((u) => u.trim()).filter(Boolean);
      if (urls.length > 0) {
        setEndpoints(urls);
      }
    }

    if (body.featuredCollections && Array.isArray(body.featuredCollections)) {
      adminConfig.featuredCollections = body.featuredCollections;
    }

    if (body.blockedCollections && Array.isArray(body.blockedCollections)) {
      adminConfig.blockedCollections = body.blockedCollections;
    }

    if (body.blockedTemplates && Array.isArray(body.blockedTemplates)) {
      adminConfig.blockedTemplates = body.blockedTemplates;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
