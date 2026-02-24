import { NextResponse } from 'next/server';
import { getHealthStatus, stats, pickEndpoint } from '@/lib/endpoint-pool';

export const runtime = 'nodejs';

export async function GET() {
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
      recentErrors: stats.errors.slice(-20).reverse(),
    },
  });
}
