'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Search, RefreshCw, Copy, Check, ExternalLink, Info, X } from 'lucide-react';
import type { LeaderboardEntry } from '@/app/api/leaderboard/route';

const LIMITS = [25, 50, 100] as const;
type Limit = (typeof LIMITS)[number];

const MEDALS = ['🥇', '🥈', '🥉'];

function getUserEndpoint(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('wax_preferred_endpoint') ?? undefined;
}

export default function LeaderboardPage() {
  const router = useRouter();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [collection, setCollection] = useState('');
  const [activeCollection, setActiveCollection] = useState('');
  const [limit, setLimit] = useState<Limit>(50);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isForceRefresh, setIsForceRefresh] = useState(false);

  // ── Data state ────────────────────────────────────────────────────────────
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featuredCollections, setFeaturedCollections] = useState<string[]>([]);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Load featured collections on mount (admin-curated list)
  useEffect(() => {
    fetch('/api/featured-collections')
      .then((r) => r.json())
      .then((json: { data?: string[] }) => setFeaturedCollections(json.data ?? []))
      .catch(() => {});
  }, []);

  // Debounce collection input → activeCollection (only search after typing stops)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = collection.trim().toLowerCase();
    if (!trimmed) {
      setActiveCollection('');
      setData([]);
      return;
    }
    debounceRef.current = setTimeout(() => setActiveCollection(trimmed), 600);
    return () => clearTimeout(debounceRef.current);
  }, [collection]);

  // Fetch leaderboard whenever activeCollection / limit / refreshKey changes
  useEffect(() => {
    if (!activeCollection) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      collection_name: activeCollection,
      limit: String(limit),
    });
    if (isForceRefresh) params.set('refresh', 'true');
    const ep = getUserEndpoint();
    if (ep) params.set('userEndpoint', ep);

    fetch(`/api/leaderboard?${params}`)
      .then((r) => r.json())
      .then((json: { success: boolean; data?: LeaderboardEntry[]; error?: string }) => {
        if (!json.success) throw new Error(json.error ?? 'Failed to load leaderboard');
        setData(json.data ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => { setLoading(false); setIsForceRefresh(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollection, limit, refreshKey]);

  const handleRefresh = useCallback(() => {
    if (loading || !activeCollection) return;
    setIsForceRefresh(true);
    setRefreshKey((k) => k + 1);
  }, [loading, activeCollection]);

  const selectCollection = (name: string) => {
    setCollection(name);
    setActiveCollection(name.toLowerCase());
  };

  const clearCollection = () => {
    setCollection('');
    setActiveCollection('');
    setData([]);
    setError(null);
  };

  const copyAccount = (acc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(acc);
    setCopiedAccount(acc);
    setTimeout(() => setCopiedAccount(null), 1500);
  };

  const hasCollection = !!activeCollection;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">NFT Whale Leaderboard</h1>
        </div>
        <p className="text-zinc-400 text-sm pl-12">
          Discover the biggest holders in any WAX NFT collection. Click any account to explore their wallet.
        </p>
      </div>

      {/* ── Collection picker ── */}
      <div className="flex flex-col gap-3 p-5 rounded-xl bg-zinc-900/60 border border-zinc-800">

        {/* Search row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="Type a collection name (e.g. alienworlds, rplanet)…"
              className="w-full pl-9 pr-10 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            {collection && (
              <button
                onClick={clearCollection}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {hasCollection && (
            <>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) as Limit)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {LIMITS.map((l) => <option key={l} value={l}>Top {l}</option>)}
              </select>

              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white disabled:opacity-50 transition-colors"
                title="Force refresh — bypass cache"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
        </div>

        {/* Featured collection chips */}
        {featuredCollections.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-zinc-600 shrink-0">Featured:</span>
            {featuredCollections.map((c) => (
              <button
                key={c}
                onClick={() => selectCollection(c)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-mono ${
                  activeCollection === c
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-amber-500/40 hover:text-amber-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {!hasCollection && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-zinc-700" />
          </div>
          <div>
            <p className="text-white font-medium">Pick a collection to see its top holders</p>
            <p className="text-zinc-500 text-sm mt-1">
              {featuredCollections.length > 0
                ? 'Type a collection name above or pick one from Featured.'
                : 'Type any WAX collection name above to get started.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {hasCollection && error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Results table ── */}
      {hasCollection && !error && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {/* Table sub-header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800">
            <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
              Top holders —{' '}
              <span className="text-amber-400 font-mono normal-case">{activeCollection}</span>
            </span>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide w-16">
                  Rank
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Account
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  NFTs
                </th>
                <th className="w-8 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-800/40">
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-8 bg-zinc-800 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-12 bg-zinc-800 rounded animate-pulse ml-auto" />
                    </td>
                    <td className="px-2 py-3.5" />
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-500 text-sm">
                    No accounts found holding &ldquo;{activeCollection}&rdquo; NFTs.
                  </td>
                </tr>
              ) : (
                data.map((entry) => (
                  <tr
                    key={entry.account}
                    onClick={() => router.push(`/wallet/${entry.account}`)}
                    className="border-b border-zinc-800/40 hover:bg-zinc-800/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3.5 text-sm w-16">
                      {entry.rank <= 3 ? (
                        <span className="text-base leading-none">{MEDALS[entry.rank - 1]}</span>
                      ) : (
                        <span className="text-zinc-500 font-mono">#{entry.rank}</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white">{entry.account}</span>
                        <button
                          onClick={(e) => copyAccount(entry.account, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300"
                          title="Copy account name"
                        >
                          {copiedAccount === entry.account
                            ? <Check className="w-3.5 h-3.5 text-green-400" />
                            : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <span className="font-mono text-sm font-semibold text-amber-400">
                        {entry.assets.toLocaleString()}
                      </span>
                    </td>

                    <td className="px-2 py-3.5">
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer note ── */}
      <div className="flex items-start gap-2 text-xs text-zinc-600">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Shows current on-chain NFT holdings, cached 5 minutes.
          Add collections to &ldquo;Featured Collections&rdquo; in the admin panel to show them as quick-picks.
          Time-frame analysis (weekly/monthly whale activity) is planned for a future update.
        </span>
      </div>

    </div>
  );
}
