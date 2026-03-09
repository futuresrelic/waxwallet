'use client';
// ─── Collection Resource Analysis Page ────────────────────────────────────────
// Shows schema/template/minted-asset RAM obligations for a WAX collection,
// from the perspective of an authorized account or collection author.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Database, Info, Layers, Loader2, RefreshCw, Shield,
  ExternalLink, ArrowLeft,
} from 'lucide-react';
import { useWalletStore } from '@/lib/store';
import type { AnalyzerResult, AnalyzerSeverity, CleanupItem } from '@/lib/analyzers/types';
import type { AccountRole, CollectionMeta } from '@/lib/analyzers/collection';
import { formatBytes } from '@/lib/analyzers/accountResources';

// ── Types for the API response ────────────────────────────────────────────────

interface CollectionData {
  collection: CollectionMeta;
  account: string | null;
  role: AccountRole;
  schemaCount: number;
  templateCount: number;
  assetCount: number;
  mintedCount: number | null;
  analyzers: AnalyzerResult[];
  endpoint: string;
}

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEV_ICON: Record<AnalyzerSeverity, React.ReactNode> = {
  ok:       <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
  info:     <Info          className="w-4 h-4 text-blue-400  shrink-0" />,
  warning:  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  critical: <AlertCircle   className="w-4 h-4 text-red-400   shrink-0" />,
};

const SEV_BORDER: Record<AnalyzerSeverity, string> = {
  ok:       'border-green-500/20 bg-green-500/5',
  info:     'border-blue-500/20  bg-blue-500/5',
  warning:  'border-amber-500/20 bg-amber-500/5',
  critical: 'border-red-500/30   bg-red-500/5',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`px-2.5 py-1 text-xs rounded-full border font-semibold ${
      active
        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
        : 'bg-zinc-800 border-zinc-700 text-zinc-500'
    }`}>
      {label}
    </span>
  );
}

function CleanupCard({ item }: { item: CleanupItem }) {
  const reclaimColor =
    item.reclaimable === 'yes'   ? 'text-green-400'  :
    item.reclaimable === 'maybe' ? 'text-amber-400'  : 'text-zinc-500';

  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{item.title}</p>
          {item.payerNote && (
            <p className="text-xs text-zinc-500 mt-0.5">{item.payerNote}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono text-zinc-400">{formatBytes(item.estimatedBytes)}</p>
          <p className={`text-xs font-semibold ${reclaimColor}`}>
            {item.reclaimable === 'yes' ? '✓ reclaimable' :
             item.reclaimable === 'maybe' ? '~ maybe' : '✗ permanent'}
          </p>
        </div>
      </div>

      {item.howToReclaim && (
        <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-zinc-700 pl-3">
          {item.howToReclaim}
        </p>
      )}

      {item.actionLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.actionLinks.map((link, i) => (
            <a
              key={i}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyzerSection({ result }: { result: AnalyzerResult }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`rounded-xl border overflow-hidden ${SEV_BORDER[result.severity]}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        {SEV_ICON[result.severity]}
        <div className="flex-1">
          <span className="text-sm font-semibold text-white">{result.title}</span>
          {result.description && (
            <span className="text-xs text-zinc-500 ml-2">{result.description}</span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{result.confidence}</span>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
      </button>

      {open && (
        <div className="border-t border-white/5">
          {result.error && (
            <p className="px-4 py-2 text-xs text-red-400">{result.error}</p>
          )}

          {result.rows.length > 0 && (
            <div className="divide-y divide-white/5">
              {result.rows.map((row, i) => (
                <div key={i} className="flex items-start justify-between gap-4 px-4 py-2">
                  <span className="text-xs text-zinc-400 w-56 shrink-0 leading-relaxed">{row.label}</span>
                  <span className={`text-xs font-mono font-semibold shrink-0 ${
                    row.value === 'error' ? 'text-red-400' :
                    row.value === 'unavailable' || row.value === 'inferred' ? 'text-zinc-600' :
                    typeof row.value === 'number' && row.value > 0 ? 'text-amber-300' :
                    'text-white'
                  }`}>
                    {String(row.value)}
                  </span>
                  {row.detail && (
                    <span className="text-xs text-zinc-600 text-right flex-1 leading-relaxed">{row.detail}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.notes && (
            <p className="px-4 py-2 border-t border-white/5 text-xs text-zinc-500 italic">{result.notes}</p>
          )}

          {result.cleanupItems && result.cleanupItems.length > 0 && (
            <div className="p-4 border-t border-white/5 flex flex-col gap-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">RAM Breakdown</p>
              {result.cleanupItems.map(item => (
                <CleanupCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CollectionResourcesPage() {
  const rawParams = useParams();
  const collectionName = Array.isArray(rawParams.name) ? rawParams.name[0] : (rawParams.name ?? '');
  const searchParams = useSearchParams();
  const { connectedAccount } = useWalletStore();

  const [accountInput, setAccountInput] = useState('');
  const [data, setData]     = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // pre-fill account from query param or connected wallet
  useEffect(() => {
    const qAccount = searchParams.get('account');
    setAccountInput(qAccount ?? connectedAccount ?? '');
  }, [connectedAccount, searchParams]);

  const analyze = useCallback(async (acc: string, refresh = false) => {
    setLoading(true);
    setError(null);
    setLastRefresh(new Date());
    try {
      const qs = `?name=${encodeURIComponent(collectionName)}&account=${encodeURIComponent(acc)}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(`/api/chain/collection${qs}`);
      const json = await res.json() as { success: boolean; data?: CollectionData; error?: string };
      if (json.success && json.data) setData(json.data);
      else setError(json.error ?? 'Failed to load collection data');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [collectionName]);

  // auto-load on mount
  useEffect(() => {
    const acc = searchParams.get('account') ?? connectedAccount ?? '';
    analyze(acc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const allCleanupItems = data?.analyzers.flatMap(r => r.cleanupItems ?? []) ?? [];
  const reclaimable = allCleanupItems.filter(c => c.reclaimable !== 'no');
  const permanent   = allCleanupItems.filter(c => c.reclaimable === 'no');
  const totalRecBytes = reclaimable.reduce((s, c) => s + c.estimatedBytes, 0);
  const totalPermBytes = permanent.reduce((s, c) => s + c.estimatedBytes, 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 py-4">

      {/* Header */}
      <div>
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Resource Inspector
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="w-6 h-6 text-amber-400" />
          Collection Analysis
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          RAM obligations for collection{' '}
          <span className="font-mono text-amber-400">{collectionName}</span>
          {' '}— from a creator / authorized account perspective.
        </p>
      </div>

      {/* Account selector */}
      <div className="flex gap-2">
        <input
          value={accountInput}
          onChange={e => setAccountInput(e.target.value.trim().toLowerCase())}
          placeholder="WAX account to check authorization (e.g. alice.wam)"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={() => analyze(accountInput, true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center gap-3 py-12 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading collection data…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Collection header card */}
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-4">
            {data.collection.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.collection.img.startsWith('http')
                  ? data.collection.img
                  : `https://ipfs.io/ipfs/${data.collection.img}`}
                alt={data.collection.name}
                className="w-16 h-16 rounded-lg object-cover bg-zinc-800"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">{data.collection.name}</h2>
                <span className="text-xs font-mono text-zinc-500">{data.collection.collection_name}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Author: <span className="font-mono text-zinc-300">{data.collection.author}</span></p>
              {lastRefresh && (
                <p className="text-xs text-zinc-600 mt-0.5">Refreshed {lastRefresh.toLocaleTimeString()}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {data.role && (
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <RoleBadge label="Author"     active={data.role.isAuthor} />
                  <RoleBadge label="Authorized" active={data.role.isAuthorized} />
                  <RoleBadge label="Notify"     active={data.role.isNotify} />
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Schemas',   value: data.schemaCount },
              { label: 'Templates', value: `${data.templateCount}${data.templateCount >= 1000 ? '+' : ''}` },
              { label: 'Assets (sample)', value: `${data.assetCount}${data.assetCount >= 1000 ? '+' : ''}` },
              { label: 'Minted by you', value: data.mintedCount !== null ? `${data.mintedCount}${data.mintedCount >= 1000 ? '+' : ''}` : 'N/A' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold font-mono text-white mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {/* RAM summary */}
          {allCleanupItems.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                RAM Obligations Summary
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="p-4 rounded-xl bg-zinc-900 border border-amber-500/20">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Permanent RAM (cannot reclaim)</p>
                  <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                    {formatBytes(totalPermBytes)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Schemas + templates — permanent in AtomicAssets
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-green-500/20">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Potentially reclaimable</p>
                  <p className="text-2xl font-bold font-mono text-green-400 mt-1">
                    {formatBytes(totalRecBytes)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Minted assets (if owners burn them)
                  </p>
                </div>
              </div>

              {/* Context note */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900 border border-blue-500/20">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs text-zinc-400 leading-relaxed">
                  <p className="font-semibold text-zinc-300 mb-1">Understanding collection RAM</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Schema rows are <strong>permanent</strong> — no delete in AtomicAssets.</li>
                    <li>Template rows are <strong>permanent</strong> — burning all assets frees asset rows but not the template row.</li>
                    <li>Asset rows are freed when the <strong>current owner burns</strong> the asset.</li>
                    <li>You cannot force reclamation on assets you no longer own.</li>
                    <li>The RAM payer is determined at creation time, not by current ownership.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Detailed analyzers */}
          <div>
            <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Detailed Analysis
            </h2>
            <div className="flex flex-col gap-3">
              {data.analyzers.map(result => (
                <AnalyzerSection key={result.id} result={result} />
              ))}
            </div>
          </div>

          {/* Data source note */}
          <p className="text-xs text-zinc-600">
            Data from {data.endpoint} · {lastRefresh?.toLocaleTimeString()}
          </p>
        </>
      )}
    </div>
  );
}
