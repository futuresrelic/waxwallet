import { Layers, Search, Zap, Shield } from 'lucide-react';
import { HomeSearch } from '@/components/HomeSearch';
import { getSettings } from '@/lib/branding-store';
import { getStoredConfig } from '@/lib/config-store';

const FEATURES = [
  {
    icon: <Layers className="w-5 h-5 text-amber-400" />,
    title: 'Full NFT Browser',
    desc: 'Browse every asset in any WAX wallet with rich media previews.',
  },
  {
    icon: <Search className="w-5 h-5 text-amber-400" />,
    title: 'Smart Filtering',
    desc: 'Filter by collection, schema, template, media type, and more.',
  },
  {
    icon: <Zap className="w-5 h-5 text-amber-400" />,
    title: 'Fast & Reliable',
    desc: 'Automatic endpoint fallback keeps the viewer running even during API outages.',
  },
  {
    icon: <Shield className="w-5 h-5 text-amber-400" />,
    title: 'Wallet Connect',
    desc: "Connect via WAX Cloud Wallet or Anchor – no private keys stored.",
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex flex-col gap-3 p-5 rounded-xl bg-zinc-900/60 border border-zinc-800"
          >
            <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
              {f.icon}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{f.title}</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
