import { NextResponse } from 'next/server';
import { getSettings, isBrandingImageAvailable } from '@/lib/branding-store';

export const runtime = 'nodejs';

export async function GET() {
  const s = getSettings();
  const v = s.updatedAt ? `?v=${encodeURIComponent(s.updatedAt)}` : '';

  const icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [];

  if (isBrandingImageAvailable('pwa-192.png')) {
    icons.push({ src: `/branding/pwa-192.png${v}`, sizes: '192x192', type: 'image/png' });
  }
  if (isBrandingImageAvailable('pwa-512.png')) {
    icons.push({
      src: `/branding/pwa-512.png${v}`,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    });
  }

  const manifest = {
    name: s.pwaName,
    short_name: s.pwaShortName,
    description: 'Browse your WAX NFT collection – AtomicAssets powered wallet viewer',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: s.primaryColor,
    icons,
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
