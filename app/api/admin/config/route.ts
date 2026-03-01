import { NextRequest, NextResponse } from 'next/server';
import { isValidSession, getSessionCookieName } from '@/lib/admin-auth';
import { getEndpoints, setEndpoints } from '@/lib/endpoint-pool';
import { getStoredConfig, saveConfig } from '@/lib/config-store';

export const runtime = 'nodejs';

// In-memory config — initialised from persisted config.json or env fallback.
function makeAdminConfig() {
  const stored = getStoredConfig();
  return {
    featuredCollections:
      stored.featuredCollections ??
      (process.env.FEATURED_COLLECTIONS ?? '').split(',').filter(Boolean),
    blockedCollections:
      stored.blockedCollections ??
      (process.env.BLOCKED_COLLECTIONS ?? '').split(',').filter(Boolean),
    blockedTemplates: [] as string[],
  };
}

export const adminConfig = makeAdminConfig();

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

    const configPatch: Parameters<typeof saveConfig>[0] = {};

    if (body.endpoints && Array.isArray(body.endpoints)) {
      const urls = (body.endpoints as string[]).map((u) => u.trim()).filter(Boolean);
      if (urls.length > 0) {
        setEndpoints(urls);
        configPatch.endpoints = urls;
      }
    }

    if (body.featuredCollections && Array.isArray(body.featuredCollections)) {
      adminConfig.featuredCollections = body.featuredCollections;
      configPatch.featuredCollections = body.featuredCollections;
    }

    if (body.blockedCollections && Array.isArray(body.blockedCollections)) {
      adminConfig.blockedCollections = body.blockedCollections;
      configPatch.blockedCollections = body.blockedCollections;
    }

    if (body.blockedTemplates && Array.isArray(body.blockedTemplates)) {
      adminConfig.blockedTemplates = body.blockedTemplates;
    }

    // Persist everything that changed to DATA_DIR/config.json
    if (Object.keys(configPatch).length > 0) {
      saveConfig(configPatch);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
