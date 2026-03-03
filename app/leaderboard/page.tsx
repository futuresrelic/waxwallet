'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Search, RefreshCw, Copy, Check, ExternalLink, Info } from 'lucide-react';
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

  const [collection, setCollection] = useState('');
  const [debouncedCollection, setDebouncedCollection] = useState('');
  const [limit, setLimit] = useState<Limit>(50);
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isForceRefresh, setIsForceRefresh] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Debounce collection input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedCollection(collection.trim().toLowerCase()), 600);
    return () => clearTimeout(debounceRef.current);
  }, [collection]);

  // Fetch leaderboard data
  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: String(limit) });
    if (debouncedCollection) params.set('collection_name', debouncedCollection);
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
  }, [debouncedCollection, limit, refreshKey]);

  const handleRefresh = useCallback(() => {
    if (loading) return;
    setIsForceRefresh(true);
    setRefreshKey((k) => k + 1);
  }, [loading]);

  const copyAccount = (acc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(acc);
    setCopiedAccount(acc);
    setTimeout(() => setCopiedAccount(null), 1500);
  };

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
          Top NFT holders on the WAX blockchain by total asset count.
          Click any row to explore that wallet.
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Collection search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            placeholder="Filter by collection…"
            className="w-full pl-9 pr-4 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {/* Limit select */}
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) as Limit)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          {LIMITS.map((l) => (
            <option key={l} value={l}>Top {l}</option>
          ))}
        </select>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white disabled:opacity-50 transition-colors"
          title="Bypass cache and fetch fresh data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide w-16">
                Rank
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Account
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Total NFTs
              </th>
              <th className="w-8 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/40">
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-8 bg-zinc-800 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-36 bg-zinc-800 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse ml-auto" />
                  </td>
                  <td className="px-2 py-3.5" />
                </tr>
              ))
            ) : !error && data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500 text-sm">
                  {debouncedCollection
                    ? `No accounts found holding "${debouncedCollection}" NFTs.`
                    : 'No data returned from the API.'}
                </td>
              </tr>
            ) : (
              data.map((entry) => (
                <tr
                  key={entry.account}
                  onClick={() => router.push(`/wallet/${entry.account}`)}
                  className="border-b border-zinc-800/40 hover:bg-zinc-800/30 cursor-pointer transition-colors group"
                >
                  {/* Rank */}
                  <td className="px-4 py-3.5 text-sm w-16">
                    {entry.rank <= 3 ? (
                      <span className="text-base leading-none">{MEDALS[entry.rank - 1]}</span>
                    ) : (
                      <span className="text-zinc-500 font-mono">#{entry.rank}</span>
                    )}
                  </td>

                  {/* Account */}
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

                  {/* NFT count */}
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-mono text-sm font-semibold text-amber-400">
                      {entry.assets.toLocaleString()}
                    </span>
                  </td>

                  {/* External link icon (always visible) */}
                  <td className="px-2 py-3.5">
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer note ── */}
      <div className="flex items-start gap-2 text-xs text-zinc-600">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Shows current on-chain NFT holdings, cached for 5 minutes.
          {debouncedCollection
            ? ` Filtered to the "${debouncedCollection}" collection.`
            : ' Filter by collection to see the top holders of a specific NFT set.'}
          {' '}Time-frame analysis (weekly/monthly whale activity) requires on-chain indexing and is planned for a future update.
        </span>
      </div>

    </div>
  );
}
