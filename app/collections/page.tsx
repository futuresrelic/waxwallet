'use client';
// ─── Collection Inspector Landing Page ────────────────────────────────────────
// Search for a WAX NFT collection and jump to its resource analysis page.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Layers, Search, ArrowRight, Activity, History,
} from 'lucide-react';
import { useWalletStore } from '@/lib/store';

const RECENT_KEY = 'wax_recent_collections';
const MAX_RECENT = 5;

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch { return []; }
}

function addRecent(name: string) {
  const prev = getRecent().filter(n => n !== name);
  localStorage.setItem(RECENT_KEY, JSON.stringify([name, ...prev].slice(0, MAX_RECENT)));
}

export default function CollectionsPage() {
  const router = useRouter();
  const { connectedAccount } = useWalletStore();

  const [input, setInput] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => { setRecent(getRecent()); }, []);

  const go = (name: string) => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    addRecent(trimmed);
    const qs = connectedAccount ? `?account=${encodeURIComponent(connectedAccount)}` : '';
    router.push(`/collection/${encodeURIComponent(trimmed)}${qs}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    go(input);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 py-12 px-4">

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
          <Layers className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Collection Inspector</h1>
        <p className="text-zinc-400 text-sm mt-2 max-w-md mx-auto">
          Enter a WAX NFT collection name to see its RAM obligations — schemas, templates, minted assets,
          and what you can and can't reclaim.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            value={input}
            onChange={e => setInput(e.target.value.trim().toLowerCase())}
            placeholder="collection name (e.g. crptomonsters)"
            autoFocus
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-40"
        >
          <ArrowRight className="w-4 h-4" />
          Inspect
        </button>
      </form>

      {/* Recent searches */}
      {recent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            Recently inspected
          </p>
          <div className="flex flex-col gap-1">
            {recent.map(name => (
              <button
                key={name}
                onClick={() => go(name)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-colors group text-left"
              >
                <span className="font-mono text-sm text-zinc-300 group-hover:text-white transition-colors">
                  {name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What this shows */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">What you'll see</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-500">
          {[
            'Collection metadata and authorization roles',
            'Schema RAM — usually permanent',
            'Template RAM — usually permanent',
            'Minted asset RAM obligations',
            'Permanent vs. potentially reclaimable split',
            'What you can and cannot reclaim, and how',
          ].map(item => (
            <div key={item} className="flex items-start gap-1.5">
              <span className="text-amber-500 mt-0.5">·</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Link back to resources */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <Link href="/resources" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
          <Activity className="w-4 h-4" />
          Wallet Resource Inspector
        </Link>
      </div>

    </div>
  );
}
