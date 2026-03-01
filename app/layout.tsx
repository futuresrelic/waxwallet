import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Providers } from '@/components/Providers';
import { SwRegister } from '@/components/SwRegister';
import { getSettings, isBrandingImageAvailable } from '@/lib/branding-store';

export async function generateViewport(): Promise<Viewport> {
  const s = getSettings();
  return {
    themeColor: s.primaryColor,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  const v = s.updatedAt ? `?v=${encodeURIComponent(s.updatedAt)}` : '';

  const icons: Metadata['icons'] = {};
  if (isBrandingImageAvailable('favicon.png')) {
    icons.icon = `/branding/favicon.png${v}`;
  }
  if (isBrandingImageAvailable('apple-touch-icon.png')) {
    icons.apple = `/branding/apple-touch-icon.png${v}`;
  }

  return {
    title: s.siteTitle,
    description: 'Browse your WAX NFT collection – AtomicAssets powered wallet viewer',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: s.pwaShortName,
    },
    ...(Object.keys(icons).length > 0 ? { icons } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { siteTitle } = getSettings();
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white min-h-screen antialiased">
        <Providers>
          <Navbar siteTitle={siteTitle} />
          <main className="max-w-screen-2xl mx-auto px-4 py-6">{children}</main>
        </Providers>
        <SwRegister />
      </body>
    </html>
  );
}
