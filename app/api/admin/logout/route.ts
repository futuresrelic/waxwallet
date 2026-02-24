import { NextResponse } from 'next/server';
import { getSessionCookieName } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(getSessionCookieName());
  return res;
}
