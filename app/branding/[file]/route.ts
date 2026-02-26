import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { getBrandingDir } from '@/lib/branding-store';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  // Sanitize: reject anything with path traversal components
  const safe = basename(file);
  if (safe !== file || safe.includes('..')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const dir = getBrandingDir();
  if (!dir) {
    return NextResponse.json({ error: 'Not configured' }, { status: 404 });
  }

  const fullPath = join(dir, safe);
  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const dotExt = '.' + safe.split('.').pop()!.toLowerCase();
  const contentType = MIME[dotExt] ?? 'application/octet-stream';

  try {
    const data = readFileSync(fullPath);
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        // Cache aggressively — URLs include ?v= cache-buster when files change
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Read error' }, { status: 500 });
  }
}
