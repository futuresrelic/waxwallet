import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'WAX Wallet Viewer',
  description: 'Browse your WAX NFT collection – AtomicAssets powered wallet viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white min-h-screen antialiased">
        <Providers>
          <Navbar />
          <main className="max-w-screen-2xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
