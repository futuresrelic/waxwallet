import { Layers, Search, Zap, Shield, Send } from 'lucide-react';
import Link from 'next/link';
import { HomeSearch } from '@/components/HomeSearch';
import { getSettings } from '@/lib/branding-store';
import { getStoredConfig } from '@/lib/config-store';

const FEATURES = [
  {
    icon: <Layers className="w-5 h-5 text-amber-400" />,
    title: 'Full NFT Browser',
    desc: 'Browse every asset in any WAX wallet with rich media previews.',
    href: null,
  },
  {
    icon: <Search className="w-5 h-5 text-amber-400" />,
    title: 'Smart Filtering',
    desc: 'Filter by collection, schema, template, media type, and more.',
    href: null,
  },
  {
    icon: <Zap className="w-5 h-5 text-amber-400" />,
    title: 'Fast & Reliable',
    desc: 'Automatic endpoint fallback keeps the viewer running even during API outages.',
    href: null,
  },
  {
    icon: <Shield className="w-5 h-5 text-amber-400" />,
    title: 'Wallet Connect',
    desc: "Connect via WAX Cloud Wallet or Anchor – no private keys stored.",
    href: null,
  },
  {
    icon: <Send className="w-5 h-5 text-amber-400" />,
    title: 'Bulk Transfer',
    desc: 'Move all or selected NFTs from one wallet to another in a few clicks. Auto-PowerUp included.',
    href: '/transfer',
  },
];

export default function HomePage() {
  const { siteTitle } = getSettings();
  const { quickWallets } = getStoredConfig();

  return (
    <div className="flex flex-col items-center gap-16 py-16">
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 text-center max-w-2xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/20">
          <span className="text-3xl font-black text-black">W</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
          {siteTitle}
        </h1>
        <p className="text-lg text-zinc-400 max-w-lg">
          An AtomicAssets-powered NFT explorer. Browse, filter, and inspect any WAX wallet&apos;s
          NFT collection with a smooth, fast experience.
        </p>
      </div>

      {/* Interactive search form (client component) */}
      <HomeSearch quickWallets={quickWallets} />

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {FEATURES.map((f) => {
          const card = (
            <div className={`flex flex-col gap-3 p-5 rounded-xl bg-zinc-900/60 border transition-colors h-full ${
              f.href
                ? 'border-amber-500/30 hover:border-amber-500/60 cursor-pointer'
                : 'border-zinc-800'
            }`}>
              <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                {f.icon}
              </div>
              <div>
                <p className="font-semibold text-white text-sm flex items-center gap-1.5">
                  {f.title}
                  {f.href && <span className="text-[10px] text-amber-400 border border-amber-500/40 rounded px-1">Open →</span>}
                </p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          );
          return f.href
            ? <Link key={f.title} href={f.href}>{card}</Link>
            : <div key={f.title}>{card}</div>;
        })}
      </div>
    </div>
  );
}
