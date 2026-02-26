import { NextRequest, NextResponse } from 'next/server';
import { isValidSession, getSessionCookieName } from '@/lib/admin-auth';
import { updateSettings } from '@/lib/branding-store';

export const runtime = 'nodejs';

function checkAuth(req: NextRequest): boolean {
  const token = req.cookies.get(getSessionCookieName())?.value;
  return isValidSession(token);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, string>;
    const allowed = ['siteTitle', 'pwaName', 'pwaShortName', 'primaryColor', 'accentColor'];
    const patch: Record<string, string> = {};
    for (const key of allowed) {
      if (typeof body[key] === 'string') patch[key] = body[key];
    }
    const updated = updateSettings(patch);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
