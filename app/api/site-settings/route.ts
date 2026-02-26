import { NextResponse } from 'next/server';
import { getSettings, isBrandingImageAvailable } from '@/lib/branding-store';

export const runtime = 'nodejs';

function imageUrl(filename: string, updatedAt: string | null): string | null {
  if (!isBrandingImageAvailable(filename)) return null;
  const v = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : '';
  return `/branding/${filename}${v}`;
}

export async function GET() {
  const s = getSettings();
  return NextResponse.json({
    success: true,
    data: {
      ...s,
      logoUrl: imageUrl('logo.png', s.updatedAt),
      faviconUrl: imageUrl('favicon.png', s.updatedAt),
      pwaIcon192Url: imageUrl('pwa-192.png', s.updatedAt),
      pwaIcon512Url: imageUrl('pwa-512.png', s.updatedAt),
      appleTouchIconUrl: imageUrl('apple-touch-icon.png', s.updatedAt),
    },
  });
}
