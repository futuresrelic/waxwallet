'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Zap, Shield, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { WalletConnectButton } from '@/components/WalletConnectButton';

const POPULAR_ACCOUNTS = ['futuresrelic', 'waxarena.gm', 'aliens.world'];

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
    desc: 'Connect via WAX Cloud Wallet or Anchor – no private keys stored.',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = account.trim().toLowerCase();
    if (!trimmed) {
      setError('Please enter a WAX account name');
      return;
    }
    if (!/^[a-z1-5.]{1,13}$/.test(trimmed)) {
      setError('Invalid WAX account name (a-z, 1-5, dots, max 13 chars)');
      return;
    }
    router.push(`/wallet/${trimmed}`);
  };

  return (
    <div className="flex flex-col items-center gap-16 py-16">
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 text-center max-w-2xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/20">
          <span className="text-3xl font-black text-black">W</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
          WAX Wallet Viewer
        </h1>
        <p className="text-lg text-zinc-400 max-w-lg">
          An AtomicAssets-powered NFT explorer. Browse, filter, and inspect any WAX wallet's
          NFT collection with a smooth, fast experience.
        </p>
      </div>

      {/* Search form */}
      <div className="w-full max-w-lg flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Enter WAX account (e.g. futuresrelic)"
            value={account}
            onChange={(e) => { setAccount(e.target.value); setError(''); }}
            error={error}
            leftIcon={<Search className="w-4 h-4" />}
          />
          <Button type="submit" size="lg" className="shrink-0">
            View
          </Button>
        </form>

        {/* Popular accounts */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-600">Quick:</span>
          {POPULAR_ACCOUNTS.map((acc) => (
            <button
              key={acc}
              onClick={() => router.push(`/wallet/${acc}`)}
              className="text-xs text-zinc-400 hover:text-amber-400 font-mono border border-zinc-800 hover:border-amber-500/30 px-2 py-1 rounded transition-colors"
            >
              {acc}
            </button>
          ))}
        </div>

        {/* Or connect */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600">or</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>
        <div className="flex justify-center">
          <WalletConnectButton />
        </div>
      </div>

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
