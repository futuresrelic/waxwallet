import { NextRequest, NextResponse } from 'next/server';
import { isValidSession, getSessionCookieName } from '@/lib/admin-auth';
import { getHealthStatus, stats, pickEndpoint } from '@/lib/endpoint-pool';

export const runtime = 'nodejs';

function checkAuth(req: NextRequest): boolean {
  const token = req.cookies.get(getSessionCookieName())?.value;
  return isValidSession(token);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const health = getHealthStatus();
  const current = pickEndpoint();
  const uptime = Math.floor((Date.now() - stats.startedAt) / 1000);

  return NextResponse.json({
    success: true,
    data: {
      endpoints: health,
      currentEndpoint: current,
      lastSuccessfulCall: stats.lastSuccessfulCall,
      errorCountLastHour: stats.errorCountLastHour,
      totalRequests: stats.totalRequests,
      uptimeSeconds: uptime,
      recentErrors: stats.errors.slice(-50).reverse(),
    },
  });
}
