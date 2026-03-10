'use client';
// ─── WAX Wallet Compare ───────────────────────────────────────────────────────
// Side-by-side resource comparison for 2–3 WAX wallets.
// Shows CPU / NET / RAM / reclaimable RAM / open offers / batch size.
// Highlights the "why heavier" differences automatically.

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, AlertCircle, ArrowLeft, CheckCircle2, Info,
  Loader2, RefreshCw, Zap, Database, Send,
} from 'lucide-react';
import { formatUs, formatBytes, pctUsed } from '@/lib/analyzers/accountResources';
import { aggregateCleanupOpportunities } from '@/lib/analyzers/ram/cleanupOpportunities';
import { recommendBatchSize } from '@/lib/analyzers/recommendations';
import type { WaxAccount, AnalyzerResult } from '@/lib/analyzers/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WalletSnapshot {
  account: string;
  waxAccount: WaxAccount | null;
  ramResults: AnalyzerResult[] | null;
  loading: boolean;
  error: string | null;
}

interface WalletMetrics {
  account: string;
  cpuPct: number | null;
  cpuAvailUs: number | null;
  netPct: number | null;
  ramUsedBytes: number | null;
  ramFreeBytes: number | null;
  ramTotalBytes: number | null;
  ramPct: number | null;
  reclaimableBytes: number;
  permanentBytes: number;
  openP2POffersSent: number;
  openMarketRows: number;
  batchSize: number;
  stakedCpu: string | null;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMetrics(snap: WalletSnapshot): WalletMetrics {
  const m: WalletMetrics = {
    account:           snap.account,
    cpuPct:            null,
    cpuAvailUs:        null,
    netPct:            null,
    ramUsedBytes:      null,
    ramFreeBytes:      null,
    ramTotalBytes:     null,
    ramPct:            null,
    reclaimableBytes:  0,
    permanentBytes:    0,
    openP2POffersSent: 0,
    openMarketRows:    0,
    batchSize:         0,
    stakedCpu:         null,
    error:             snap.error,
  };

  if (snap.waxAccount) {
    const a = snap.waxAccount;
    m.cpuPct        = pctUsed(a.cpu_limit);
    m.cpuAvailUs    = a.cpu_limit.available;
    m.netPct        = pctUsed(a.net_limit);
    m.ramUsedBytes  = a.ram_usage;
    m.ramFreeBytes  = a.ram_quota - a.ram_usage;
    m.ramTotalBytes = a.ram_quota;
    m.ramPct        = a.ram_quota > 0 ? (a.ram_usage / a.ram_quota) * 100 : 0;
    m.batchSize     = recommendBatchSize(a.cpu_limit.available);
    m.stakedCpu     = a.self_delegated_bandwidth?.cpu_weight ?? null;
  }

  if (snap.ramResults) {
    const agg = aggregateCleanupOpportunities(snap.ramResults);
    m.reclaimableBytes = agg.reclaimable.reduce((s, c) => s + c.estimatedBytes, 0);
    m.permanentBytes   = agg.notReclaimable.reduce((s, c) => s + c.estimatedBytes, 0);

    // Open P2P offers sent (atomicassets result)
    const aaResult = snap.ramResults.find(r => r.id === 'ram_atomicassets');
    if (aaResult) {
      const offerRow = aaResult.rows.find(r => r.label === 'Open P2P trade offers sent by you');
      if (offerRow && typeof offerRow.value === 'number') m.openP2POffersSent = offerRow.value;
    }

    // Open market rows (atomicmarket result)
    const amResult = snap.ramResults.find(r => r.id === 'ram_atomicmarket');
    if (amResult) {
      const sales    = amResult.rows.find(r => r.label.includes('sale listing'));
      const auctions = amResult.rows.find(r => r.label.includes('auction'));
      const buys     = amResult.rows.find(r => r.label.includes('buy offer'));
      const count = [sales, auctions, buys]
        .filter(Boolean)
        .reduce((s, r) => s + (typeof r!.value === 'number' ? r!.value : 0), 0);
      m.openMarketRows = count;
    }
  }

  return m;
}

/** Generate a short explanation of why this wallet is "heavier" relative to others. */
function explainWeight(current: WalletMetrics, others: WalletMetrics[]): string[] {
  const notes: string[] = [];
  if (current.ramUsedBytes == null) return notes;

  const avgRamPct   = others.reduce((s, o) => s + (o.ramPct ?? 0), 0) / (others.length || 1);
  const avgReclaim  = others.reduce((s, o) => s + o.reclaimableBytes, 0) / (others.length || 1);
  const avgP2P      = others.reduce((s, o) => s + o.openP2POffersSent, 0) / (others.length || 1);
  const avgMarket   = others.reduce((s, o) => s + o.openMarketRows, 0) / (others.length || 1);
  const avgCpu      = others.reduce((s, o) => s + (o.cpuPct ?? 0), 0) / (others.length || 1);

  if ((current.ramPct ?? 0) > avgRamPct + 10) {
    notes.push(`Higher RAM usage (${(current.ramPct ?? 0).toFixed(1)}% vs avg ${avgRamPct.toFixed(1)}%)`);
  }
  if (current.reclaimableBytes > avgReclaim + 2048) {
    notes.push(`More reclaimable RAM (${formatBytes(current.reclaimableBytes)} vs avg ${formatBytes(avgReclaim)})`);
  }
  if (current.openP2POffersSent > avgP2P + 2) {
    notes.push(`More open P2P trade offers sent (${current.openP2POffersSent} vs avg ${avgP2P.toFixed(0)})`);
  }
  if (current.openMarketRows > avgMarket + 2) {
    notes.push(`More open marketplace rows (${current.openMarketRows} vs avg ${avgMarket.toFixed(0)})`);
  }
  if ((current.cpuPct ?? 0) > avgCpu + 15) {
    notes.push(`Higher CPU usage (${(current.cpuPct ?? 0).toFixed(1)}% vs avg ${avgCpu.toFixed(1)}%)`);
  }
  if ((current.ramFreeBytes ?? 0) < 2048 && (current.ramTotalBytes ?? 0) > 0) {
    notes.push('Critically low free RAM — wallet may fail to receive tokens or NFTs');
  }
  if (notes.length === 0) {
    // Check if it's the lightest
    const lightest = others.every(o => (o.ramPct ?? 0) >= (current.ramPct ?? 0));
    if (lightest) notes.push('Lightest RAM profile in this comparison');
    else notes.push('No significant outlier detected');
  }

  return notes;
}

// ── Metric cell ───────────────────────────────────────────────────────────────

function Cell({
  value, highlight = false, dimmed = false,
}: {
  value: React.ReactNode;
  highlight?: boolean;
  dimmed?: boolean;
}) {
  return (
    <td className={`px-3 py-2 text-right text-xs font-mono ${
      highlight ? 'text-amber-400 font-semibold' :
      dimmed    ? 'text-zinc-600' :
                  'text-zinc-300'
    }`}>
      {value}
    </td>
  );
}

function pctColor(pct: number | null): boolean {
  return pct != null && pct > 70;
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_SLOT = '';

export default function WalletComparePage() {
  const [inputs, setInputs] = useState(['', '', '']);
  const [snaps,  setSnaps]  = useState<(WalletSnapshot | null)[]>([null, null, null]);

  const setInput = (i: number, v: string) =>
    setInputs(prev => prev.map((x, idx) => idx === i ? v.trim().toLowerCase() : x));

  const fetchWallet = useCallback(async (account: string, index: number, refresh = false) => {
    if (!account) return;

    setSnaps(prev => {
      const next = [...prev];
      next[index] = { account, waxAccount: null, ramResults: null, loading: true, error: null };
      return next;
    });

    const qs = `?account=${encodeURIComponent(account)}${refresh ? '&refresh=true' : ''}`;

    const [accountRes, ramRes] = await Promise.allSettled([
      fetch(`/api/chain/account${qs}`).then(r => r.json()),
      fetch(`/api/chain/ram${qs}`).then(r => r.json()),
    ]);

    const waxAccount = accountRes.status === 'fulfilled' && accountRes.value.success
      ? accountRes.value.data as WaxAccount
      : null;
    const ramResults = ramRes.status === 'fulfilled' && ramRes.value.success
      ? ramRes.value.data as AnalyzerResult[]
      : null;
    const error = !waxAccount
      ? ((accountRes.status === 'fulfilled' ? accountRes.value.error : String((accountRes as PromiseRejectedResult).reason)) ?? 'Failed to load')
      : null;

    setSnaps(prev => {
      const next = [...prev];
      next[index] = { account, waxAccount, ramResults, loading: false, error };
      return next;
    });
  }, []);

  const handleAnalyze = () => {
    inputs.forEach((acc, i) => { if (acc) fetchWallet(acc, i); });
  };

  const handleRefresh = () => {
    inputs.forEach((acc, i) => { if (acc) fetchWallet(acc, i, true); });
  };

  // Only include slots that have an account
  const activeSnaps = snaps.filter((s, i) => inputs[i] || s !== null);
  const loadedSnaps = snaps.filter(s => s !== null && !s.loading);
  const isLoading   = snaps.some(s => s?.loading);
  const metrics     = snaps.map(s => s ? extractMetrics(s) : null);
  const hasData     = loadedSnaps.length > 0;

  // For highlight: find the "worst" value per row
  const maxRamPct   = Math.max(...metrics.map(m => m?.ramPct  ?? -1));
  const maxCpuPct   = Math.max(...metrics.map(m => m?.cpuPct  ?? -1));
  const maxReclaim  = Math.max(...metrics.map(m => m?.reclaimableBytes ?? -1));
  const maxP2P      = Math.max(...metrics.map(m => m?.openP2POffersSent ?? -1));
  const maxMarket   = Math.max(...metrics.map(m => m?.openMarketRows    ?? -1));

  const PLACEHOLDER = '—';

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 py-4">

      {/* Header */}
      <div>
        <Link href="/resources"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-3 transition-colors">
          <ArrowLeft className="w-3 h-3" />
          Back to Resource Inspector
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-amber-400" />
          Wallet Comparison
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Compare CPU, NET, RAM, and reclaimable rows across 2–3 WAX wallets side by side.
        </p>
      </div>

      {/* Account inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
              Wallet {i + 1}{i > 0 ? ' (optional)' : ''}
            </label>
            <input
              value={inputs[i]}
              onChange={e => setInput(i, e.target.value)}
              placeholder={i === 0 ? 'e.g. alice.wam' : i === 1 ? 'e.g. bob.wam' : 'e.g. carol.wam'}
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !inputs.some(Boolean)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          {isLoading ? 'Analyzing…' : 'Compare'}
        </button>
        {hasData && (
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        )}
      </div>

      {/* Loading indicators per wallet */}
      {snaps.some(s => s?.loading) && (
        <div className="flex flex-wrap gap-3">
          {snaps.map((s, i) => s?.loading && (
            <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading {s.account}…
            </div>
          ))}
        </div>
      )}

      {/* Comparison table */}
      {hasData && (() => {
        const cols = snaps.filter((s, i) => inputs[i] || s !== null);
        const colMetrics = metrics.filter((_, i) => inputs[i] || snaps[i] !== null);

        return (
          <div className="flex flex-col gap-6">
            {/* Main comparison table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    <th className="text-left px-3 py-3 text-zinc-500 font-semibold uppercase tracking-wider w-48">
                      Metric
                    </th>
                    {colMetrics.map((m, i) => (
                      <th key={i} className="text-right px-3 py-3 font-mono text-amber-400">
                        {m?.account ?? inputs[i] ?? `Wallet ${i + 1}`}
                        {snaps[i]?.loading && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
                        {snaps[i]?.error && <AlertCircle className="w-3 h-3 text-red-400 inline ml-1" />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">

                  {/* CPU section */}
                  <tr className="bg-zinc-900/60">
                    <td colSpan={colMetrics.length + 1} className="px-3 py-1.5">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400/50" /> CPU
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Used %</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.cpuPct != null ? `${m.cpuPct.toFixed(1)}%` : PLACEHOLDER}
                        highlight={m?.cpuPct === maxCpuPct && maxCpuPct > 70}
                        dimmed={m == null}
                      />
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Available</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.cpuAvailUs != null ? formatUs(m.cpuAvailUs) : PLACEHOLDER}
                        dimmed={m == null}
                      />
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Staked CPU</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.stakedCpu ?? PLACEHOLDER}
                        dimmed={m == null}
                      />
                    ))}
                  </tr>

                  {/* NET section */}
                  <tr className="bg-zinc-900/60">
                    <td colSpan={colMetrics.length + 1} className="px-3 py-1.5">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
                        <Activity className="w-3 h-3 text-blue-400/50" /> NET
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Used %</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.netPct != null ? `${m.netPct.toFixed(1)}%` : PLACEHOLDER}
                        highlight={m?.netPct != null && m.netPct > 70}
                        dimmed={m == null}
                      />
                    ))}
                  </tr>

                  {/* RAM section */}
                  <tr className="bg-zinc-900/60">
                    <td colSpan={colMetrics.length + 1} className="px-3 py-1.5">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
                        <Database className="w-3 h-3 text-amber-400/50" /> RAM
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Used %</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.ramPct != null ? `${m.ramPct.toFixed(1)}%` : PLACEHOLDER}
                        highlight={m?.ramPct === maxRamPct && maxRamPct > 70}
                        dimmed={m == null}
                      />
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Used</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.ramUsedBytes != null ? formatBytes(m.ramUsedBytes) : PLACEHOLDER}
                        highlight={m?.ramPct === maxRamPct && maxRamPct > 70}
                        dimmed={m == null}
                      />
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Free</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.ramFreeBytes != null ? formatBytes(m.ramFreeBytes) : PLACEHOLDER}
                        highlight={m?.ramFreeBytes != null && m.ramFreeBytes < 2048}
                        dimmed={m == null}
                      />
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Total quota</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.ramTotalBytes != null ? formatBytes(m.ramTotalBytes) : PLACEHOLDER}
                        dimmed={m == null}
                      />
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">
                      Reclaimable RAM
                      <span className="block text-[10px] text-zinc-600">(tracked categories)</span>
                    </td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m != null ? formatBytes(m.reclaimableBytes) : PLACEHOLDER}
                        highlight={m?.reclaimableBytes === maxReclaim && maxReclaim > 512}
                        dimmed={m == null || m.reclaimableBytes === 0}
                      />
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">
                      Permanent RAM
                      <span className="block text-[10px] text-zinc-600">(cannot reclaim)</span>
                    </td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m != null ? formatBytes(m.permanentBytes) : PLACEHOLDER}
                        dimmed={m == null || m.permanentBytes === 0}
                      />
                    ))}
                  </tr>

                  {/* Open rows section */}
                  <tr className="bg-zinc-900/60">
                    <td colSpan={colMetrics.length + 1} className="px-3 py-1.5">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                        Open Market / Offer Rows
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">P2P offers sent</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m != null ? m.openP2POffersSent : PLACEHOLDER}
                        highlight={m?.openP2POffersSent === maxP2P && maxP2P > 0}
                        dimmed={m == null || m.openP2POffersSent === 0}
                      />
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Market listings / offers</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m != null ? m.openMarketRows : PLACEHOLDER}
                        highlight={m?.openMarketRows === maxMarket && maxMarket > 0}
                        dimmed={m == null || m.openMarketRows === 0}
                      />
                    ))}
                  </tr>

                  {/* Transfer readiness */}
                  <tr className="bg-zinc-900/60">
                    <td colSpan={colMetrics.length + 1} className="px-3 py-1.5">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
                        <Send className="w-3 h-3 text-green-400/50" /> Transfer Readiness
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-400">Rec. batch size</td>
                    {colMetrics.map((m, i) => (
                      <Cell key={i}
                        value={m?.batchSize != null && m.batchSize > 0 ? m.batchSize : PLACEHOLDER}
                        dimmed={m == null || m.batchSize === 0}
                      />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* "Why heavier" explanations */}
            {colMetrics.filter(Boolean).length > 1 && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  Wallet Differences Explained
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {colMetrics.map((m, i) => {
                    if (!m) return null;
                    const others = colMetrics.filter((o, j) => o !== null && j !== i) as WalletMetrics[];
                    const notes  = explainWeight(m, others);
                    return (
                      <div key={i} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                        <p className="text-sm font-mono font-semibold text-amber-400 mb-2">{m.account}</p>
                        {m.error ? (
                          <p className="text-xs text-red-400">{m.error}</p>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {notes.map((note, j) => (
                              <li key={j} className="flex items-start gap-2 text-xs text-zinc-400">
                                {note.includes('Lightest') || note.includes('no significant') ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                                ) : note.includes('critically') ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                                ) : (
                                  <span className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400 font-bold text-[10px]">▲</span>
                                )}
                                {note}
                              </li>
                            ))}
                          </ul>
                        )}
                        <Link
                          href={`/resources?account=${encodeURIComponent(m.account)}`}
                          className="mt-3 text-[11px] text-zinc-600 hover:text-amber-400 transition-colors flex items-center gap-1"
                        >
                          Full analysis →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legend */}
            <p className="text-xs text-zinc-600 flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              Amber highlights indicate the highest value in each row. RAM estimates are approximate.
            </p>
          </div>
        );
      })()}

      {/* Empty state */}
      {!hasData && !isLoading && (
        <div className="text-center py-16 text-zinc-600">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Enter 2–3 WAX wallet names and click Compare.</p>
        </div>
      )}
    </div>
  );
}
