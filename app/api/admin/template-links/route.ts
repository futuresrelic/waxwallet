// ─── Admin: Template Links CRUD ───────────────────────────────────────────────
// Auth-protected. All methods require a valid admin session cookie.
//
// GET    → list all links (including disabled)
// POST   → create a link  { template_id, label?, url, enabled? }
// PATCH  → update a link  { id, ...fields }
// DELETE → delete a link  ?id=<id>

import { NextRequest, NextResponse } from 'next/server';
import { isValidSession, getSessionCookieName } from '@/lib/admin-auth';
import { getAllLinks, createLink, updateLink, deleteLink } from '@/lib/template-links-store';

export const runtime = 'nodejs';

function checkAuth(req: NextRequest): boolean {
  const token = req.cookies.get(getSessionCookieName())?.value;
  return isValidSession(token);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ success: true, data: getAllLinks() });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.template_id || !body.url) {
      return NextResponse.json({ error: 'template_id and url are required' }, { status: 400 });
    }
    const link = createLink({
      template_id: String(body.template_id).trim(),
      label: String(body.label ?? 'View').trim() || 'View',
      url: String(body.url).trim(),
      enabled: body.enabled !== false,
    });
    return NextResponse.json({ success: true, data: link }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (body.template_id !== undefined) patch.template_id = String(body.template_id).trim();
    if (body.label !== undefined) patch.label = String(body.label).trim() || 'View';
    if (body.url !== undefined) patch.url = String(body.url).trim();
    if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
    const updated = updateLink(body.id, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const deleted = deleteLink(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
