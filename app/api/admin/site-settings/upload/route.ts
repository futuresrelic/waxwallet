import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidSession, getSessionCookieName } from '@/lib/admin-auth';
import { ensureBrandingDir, updateSettings } from '@/lib/branding-store';

export const runtime = 'nodejs';

const ALLOWED_NAMES = [
  'logo.png',
  'favicon.png',
  'pwa-192.png',
  'pwa-512.png',
  'apple-touch-icon.png',
];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = [
  'image/png',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

function checkAuth(req: NextRequest): boolean {
  const token = req.cookies.get(getSessionCookieName())?.value;
  return isValidSession(token);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dir = ensureBrandingDir();
  if (!dir) {
    return NextResponse.json(
      {
        success: false,
        error:
          'DATA_DIR not configured. Mount a Railway Volume and set DATA_DIR=/data in service Variables.',
      },
      { status: 503 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;

    if (!file || !name) {
      return NextResponse.json(
        { success: false, error: '"file" and "name" are required' },
        { status: 400 },
      );
    }

    if (!ALLOWED_NAMES.includes(name)) {
      return NextResponse.json(
        { success: false, error: `name must be one of: ${ALLOWED_NAMES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only PNG, SVG, and ICO files are allowed' },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File must be 2 MB or smaller' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(join(dir, name), buffer);

    // Bump updatedAt so cache-busting URLs in /branding/* change
    updateSettings({});

    return NextResponse.json({ success: true, data: { name, size: file.size } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
