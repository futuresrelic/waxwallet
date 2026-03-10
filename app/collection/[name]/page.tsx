'use client';
// ─── Collection Resource Analysis Page ────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Database, Info, Layers, Loader2, RefreshCw,
  ExternalLink, ArrowLeft, Bug, Link2,
} from 'lucide-react';
import { atomicHub } from '@/lib/link-builders/atomichub';
import { neftyBlocks } from '@/lib/link-builders/nefty';
import { useWalletStore } from '@/lib/store';
import type { AnalyzerResult, AnalyzerSeverity, CleanupItem } from '@/lib/analyzers/types';
import type { AccountRole, CollectionMeta } from '@/lib/analyzers/collection';
import type { SchemaWithStats } from '@/app/api/chain/collection/route';
import { formatBytes } from '@/lib/analyzers/accountResources';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DebugSource {
  url: string;
  status: 'ok' | 'failed';
  result: string;
}

interface CollectionData {
  collection: CollectionMeta;
  stats: { assets: number | null; burned_assets: number | null };
  schemas: SchemaWithStats[];
  schemaCount: number | null;
  templateCount: number | null;
  assetCount: number | null;
  account: string | null;
  role: AccountRole;
  analyzers: AnalyzerResult[];
  sources: DebugSource[];
  endpoint: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Show a number or a fallback string — never fake zeroes. */
function Metric({
  value, label, source, suffix = '',
}: {
  value: number | null | undefined;
  label: string;
  source?: string;
  suffix?: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      {value != null ? (
        <p className="text-2xl font-bold font-mono text-white mt-0.5">
          {value.toLocaleString()}{suffix}
        </p>
      ) : (
        <p className="text-sm text-zinc-600 mt-1 italic">Unavailable</p>
      )}
      {source && <p className="text-[10px] text-zinc-700 mt-0.5">{source}</p>}
    </div>
  );
}

const SEV_ICON: Record<AnalyzerSeverity, React.ReactNode> = {
  ok:       <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
  info:     <Info          className="w-4 h-4 text-blue-400  shrink-0" />,
  warning:  <AlertCircle  className="w-4 h-4 text-amber-400 shrink-0" />,
  critical: <AlertCircle  className="w-4 h-4 text-red-400   shrink-0" />,
};

const SEV_BORDER: Record<AnalyzerSeverity, string> = {
  ok:       'border-green-500/20',
  info:     'border-blue-500/20',
  warning:  'border-amber-500/20',
  critical: 'border-red-500/30',
};

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
          {item.payerNote && <p className="text-xs text-zinc-500 mt-0.5">{item.payerNote}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono text-zinc-400">{formatBytes(item.estimatedBytes)}</p>
          <p className={`text-xs font-semibold ${reclaimColor}`}>
            {item.reclaimable === 'yes' ? '✓ reclaimable' :
             item.reclaimable === 'maybe' ? '~ possibly' : '✗ permanent'}
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
            <a key={i} href={link.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
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
    <div className={`rounded-xl border overflow-hidden ${SEV_BORDER[result.severity]} bg-zinc-900/40`}>
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
          {result.error && <p className="px-4 py-2 text-xs text-red-400">{result.error}</p>}
          {result.rows.length > 0 && (
            <div className="divide-y divide-white/5">
              {result.rows.map((row, i) => (
                <div key={i} className="flex items-start justify-between gap-4 px-4 py-2">
                  <span className="text-xs text-zinc-400 w-56 shrink-0 leading-relaxed">{row.label}</span>
                  <span className={`text-xs font-mono font-semibold shrink-0 ${
                    row.value === 'error' ? 'text-red-400' :
                    typeof row.value === 'number' && row.value > 0 ? 'text-amber-300' :
                    'text-white'
                  }`}>{String(row.value)}</span>
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
              {result.cleanupItems.map(item => <CleanupCard key={item.id} item={item} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Schemas table ─────────────────────────────────────────────────────────────

function SchemasTable({ schemas }: { schemas: SchemaWithStats[] }) {
  const [open, setOpen] = useState(true);
  if (schemas.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800/60 transition-colors"
      >
        <p className="text-sm font-semibold text-white">
          Categories / Schemas
          <span className="ml-2 text-xs text-zinc-500 font-normal">({schemas.length})</span>
        </p>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left px-4 py-2 text-zinc-500 font-semibold uppercase tracking-wider">Schema / Category</th>
                <th className="text-right px-4 py-2 text-zinc-500 font-semibold uppercase tracking-wider">Attributes</th>
                <th className="text-right px-4 py-2 text-zinc-500 font-semibold uppercase tracking-wider">Templates</th>
                <th className="text-right px-4 py-2 text-zinc-500 font-semibold uppercase tracking-wider">Assets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {schemas.map(s => (
                <tr key={s.schema_name} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-2 font-mono text-zinc-300">{s.schema_name}</td>
                  <td className="px-4 py-2 text-right text-zinc-400">{s.format?.length ?? 0}</td>
                  <td className="px-4 py-2 text-right text-zinc-300 font-mono">
                    {s.templateCount != null ? s.templateCount.toLocaleString() : <span className="text-zinc-600 italic">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-300 font-mono">
                    {s.assetCount != null ? s.assetCount.toLocaleString() : <span className="text-zinc-600 italic">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[10px] text-zinc-700 border-t border-zinc-800">
            Source: /atomicassets/v1/schemas/{'{collection}'}/{'{schema}'}/stats — exact counts
          </p>
        </div>
      )}
    </div>
  );
}

// ── Debug panel ───────────────────────────────────────────────────────────────

function DebugPanel({ sources, endpoint }: { sources: DebugSource[]; endpoint: string }) {
  const [open, setOpen] = useState(false);
  const failed = sources.filter(s => s.status === 'failed');
  return (
    <details open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors select-none py-1">
        <Bug className="w-3.5 h-3.5" />
        Debug data sources
        {failed.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-semibold">
            {failed.length} failed
          </span>
        )}
      </summary>
      <div className="mt-2 rounded-xl border border-zinc-800 overflow-hidden text-xs">
        <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-zinc-500">Endpoint: <span className="font-mono text-zinc-400">{endpoint}</span></span>
          <span className="text-zinc-600">{sources.length} requests</span>
        </div>
        <div className="divide-y divide-zinc-800/40 max-h-80 overflow-y-auto">
          {sources.map((s, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-2">
              <span className={`shrink-0 font-semibold ${s.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {s.status === 'ok' ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-zinc-400 break-all leading-relaxed">{s.url}</p>
                <p className={`mt-0.5 ${s.status === 'ok' ? 'text-zinc-600' : 'text-red-400/70'}`}>{s.result}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CollectionResourcesPage() {
  const rawParams = useParams();
  const collectionName = Array.isArray(rawParams.name) ? rawParams.name[0] : (rawParams.name ?? '');
  const searchParams = useSearchParams();
  const { connectedAccount } = useWalletStore();

  const [accountInput, setAccountInput] = useState('');
  const [data, setData]       = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    const qAccount = searchParams.get('account');
    setAccountInput(qAccount ?? connectedAccount ?? '');
  }, [connectedAccount, searchParams]);

  const analyze = useCallback(async (acc: string, refresh = false) => {
    if (!collectionName) return;
    setLoading(true); setError(null); setLastRefresh(new Date());
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

  useEffect(() => {
    const acc = searchParams.get('account') ?? connectedAccount ?? '';
    analyze(acc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const allCleanupItems = data?.analyzers.flatMap(r => r.cleanupItems ?? []) ?? [];
  const reclaimable  = allCleanupItems.filter(c => c.reclaimable !== 'no');
  const permanent    = allCleanupItems.filter(c => c.reclaimable === 'no');
  const totalRecBytes  = reclaimable.reduce((s, c) => s + c.estimatedBytes, 0);
  const totalPermBytes = permanent.reduce((s, c) => s + c.estimatedBytes, 0);

  const createdAt = data
    ? new Date(Number(data.collection.created_at_time))
    : null;
  const createdDisplay = createdAt && !isNaN(createdAt.getTime())
    ? createdAt.toLocaleDateString()
    : 'Unavailable';

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 py-4">

      {/* Header */}
      <div>
        <Link href="/collections"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-3 transition-colors">
          <ArrowLeft className="w-3 h-3" />
          Back to Collection Inspector
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="w-6 h-6 text-amber-400" />
          Collection Analysis
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          RAM obligations for <span className="font-mono text-amber-400">{collectionName}</span>
          {' '}— from a creator / authorized account perspective.
        </p>
      </div>

      {/* Account selector */}
      <div className="flex gap-2">
        <input
          value={accountInput}
          onChange={e => setAccountInput(e.target.value.trim().toLowerCase())}
          placeholder="WAX account to check roles (optional — leave blank for collection overview)"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={() => analyze(accountInput, true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Loading…' : 'Analyze'}
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-3 py-12 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Fetching collection data…
        </div>
      )}

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
                className="w-16 h-16 rounded-lg object-cover bg-zinc-800 shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">{data.collection.name || data.collection.collection_name}</h2>
                <span className="text-xs font-mono text-zinc-500">{data.collection.collection_name}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
                <span>Author: <span className="font-mono text-zinc-300">{data.collection.author}</span></span>
                <span>Market fee: <span className="text-zinc-300">{(data.collection.market_fee * 100).toFixed(2)}%</span></span>
                <span>Created: <span className="text-zinc-300">{createdDisplay}</span></span>
              </div>
              {lastRefresh && (
                <p className="text-[11px] text-zinc-700 mt-1">Refreshed {lastRefresh.toLocaleTimeString()} · {data.endpoint}</p>
              )}
            </div>
            {data.role && (
              <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                <RoleBadge label="Author"     active={data.role.isAuthor} />
                <RoleBadge label="Authorized" active={data.role.isAuthorized} />
                <RoleBadge label="Notify"     active={data.role.isNotify} />
              </div>
            )}
          </div>

          {/* Authorized / notify accounts */}
          {(data.collection.authorized_accounts.length > 0 || data.collection.notify_accounts.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
                  Authorized Accounts ({data.collection.authorized_accounts.length})
                </p>
                {data.collection.authorized_accounts.length > 0
                  ? data.collection.authorized_accounts.map(a => (
                    <p key={a} className={`text-xs font-mono ${a === data.account ? 'text-amber-400 font-semibold' : 'text-zinc-300'}`}>{a}</p>
                  ))
                  : <p className="text-xs text-zinc-600 italic">None</p>
                }
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
                  Notify Accounts ({data.collection.notify_accounts.length})
                </p>
                {data.collection.notify_accounts.length > 0
                  ? data.collection.notify_accounts.map(a => (
                    <p key={a} className={`text-xs font-mono ${a === data.account ? 'text-amber-400 font-semibold' : 'text-zinc-300'}`}>{a}</p>
                  ))
                  : <p className="text-xs text-zinc-600 italic">None</p>
                }
              </div>
            </div>
          )}

          {/* External links */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <a
                href={atomicHub.collection(data.collection.collection_name)}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                AtomicHub
              </a>
              <a
                href={atomicHub.collectionTemplates(data.collection.collection_name)}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Templates on AtomicHub
              </a>
              <a
                href={neftyBlocks.collection(data.collection.collection_name)}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                NeftyBlocks
              </a>
              <a
                href={neftyBlocks.templates(data.collection.collection_name)}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Templates on NeftyBlocks
              </a>
            </div>
            <p className="text-[11px] text-zinc-600 flex items-center gap-1">
              <Info className="w-3 h-3" />
              External links open in a new tab. Login state on those sites is independent of this app.
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric
              value={data.schemaCount}
              label="Schemas / Categories"
              source="schemas endpoint"
            />
            <Metric
              value={data.templateCount}
              label="Templates (total)"
              source="schema stats — exact"
            />
            <Metric
              value={data.assetCount}
              label="Live Assets"
              source="collection stats — exact"
            />
            <Metric
              value={data.stats.burned_assets}
              label="Burned Assets"
              source="collection stats — exact"
            />
          </div>

          {/* Schemas / Categories table */}
          {data.schemas.length > 0 && (
            <SchemasTable schemas={data.schemas} />
          )}
          {data.schemas.length === 0 && data.schemaCount === null && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-amber-500/20 text-sm text-amber-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              Schema list unavailable — the schemas endpoint did not return data. Check the debug panel below.
            </div>
          )}

          {/* Minted Assets Lifecycle */}
          {(data.assetCount != null || data.stats.burned_assets != null) && (() => {
            // All values from collection/stats endpoint — exact counts from AtomicAssets.
            // RAM per asset row is estimated at ~512 bytes (struct size approximation).
            const BYTES_PER_ASSET = 512;
            const live   = data.assetCount         ?? 0;
            const burned = data.stats.burned_assets ?? 0;
            const totalMinted = live + burned;
            const liveRam    = live   * BYTES_PER_ASSET;
            const reclaimedRam = burned * BYTES_PER_ASSET;
            const totalRam   = totalMinted * BYTES_PER_ASSET;

            return (
              <div>
                <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  Minted Assets Lifecycle
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total minted ever</p>
                    <p className="text-xl font-bold font-mono text-white mt-1">
                      {totalMinted.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">live + burned</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Still circulating / live</p>
                    <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                      {live.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">RAM still allocated</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Burned</p>
                    <p className="text-xl font-bold font-mono text-green-400 mt-1">
                      {burned.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">RAM already freed</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-amber-500/20">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Est. RAM — live asset rows</p>
                    <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                      {formatBytes(liveRam)}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Still allocated · ~512 bytes/row</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-green-500/20">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Est. RAM reclaimed by burns</p>
                    <p className="text-xl font-bold font-mono text-green-400 mt-1">
                      {formatBytes(reclaimedRam)}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Already freed on burnasset</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Est. total asset RAM ever</p>
                    <p className="text-xl font-bold font-mono text-zinc-400 mt-1">
                      {formatBytes(totalRam)}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Peak allocation over lifetime</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-zinc-400 leading-relaxed space-y-1">
                    <p>
                      <strong className="text-zinc-300">Who pays:</strong>{' '}
                      The account that minted each asset (the <em>authorized_minter</em> at the time of mint) is the RAM payer — not the current owner.
                    </p>
                    <p>
                      <strong className="text-zinc-300">When is RAM freed:</strong>{' '}
                      Each asset row is freed when the <em>current owner</em> calls <code>burnasset</code>. You cannot force reclamation once ownership was transferred.
                    </p>
                    <p>
                      <strong className="text-zinc-300">Row estimate:</strong>{' '}
                      ~512 bytes per asset row is an approximation based on typical AtomicAssets struct sizes. Actual usage varies by attribute count and data density.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* What you can and cannot reclaim */}
          <div>
            <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              RAM Obligations — What You Can Reclaim
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {allCleanupItems.length > 0 && (
                <>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-amber-500/20">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Permanent RAM</p>
                    <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{formatBytes(totalPermBytes)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Schemas + templates — cannot be reclaimed under normal AtomicAssets behavior</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-green-500/20">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Possibly reclaimable</p>
                    <p className="text-2xl font-bold font-mono text-green-400 mt-1">{formatBytes(totalRecBytes)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Asset RAM — freed only when current owners burn their assets</p>
                  </div>
                </>
              )}
            </div>

            {/* Concise split: can / cannot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Can reclaim
                </p>
                <ul className="space-y-1.5 text-xs text-zinc-400">
                  <li className="flex items-start gap-1.5">
                    <span className="text-green-400 mt-px">›</span>
                    <span><strong className="text-zinc-300">Live asset rows</strong> — only when the <em>current owner</em> burns the asset. You cannot force this once ownership has transferred.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-green-400 mt-px">›</span>
                    <span><strong className="text-zinc-300">Assets you still own</strong> — you can burn your own holdings directly to reclaim your RAM.</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Cannot reclaim
                </p>
                <ul className="space-y-1.5 text-xs text-zinc-400">
                  <li className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-px">›</span>
                    <span><strong className="text-zinc-300">Schema rows</strong> — AtomicAssets has no delete-schema operation. Permanent.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-px">›</span>
                    <span><strong className="text-zinc-300">Template rows</strong> — AtomicAssets has no delete-template operation. Permanent even if all assets of a template are burned.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-px">›</span>
                    <span><strong className="text-zinc-300">Collection row / auth lists</strong> — permanent under normal conditions unless the collection structure is dissolved.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Detailed analyzers */}
          <div>
            <h2 className="text-base font-semibold text-white mb-3">Detailed Analysis</h2>
            <div className="flex flex-col gap-3">
              {data.analyzers.map(result => (
                <AnalyzerSection key={result.id} result={result} />
              ))}
            </div>
          </div>

          {/* Debug panel */}
          <DebugPanel sources={data.sources} endpoint={data.endpoint} />
        </>
      )}
    </div>
  );
}
