'use client';
// ─── WAX Resource Inspector / Control Panel ──────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  ExternalLink, Info, Layers, Loader2, RefreshCw, Search, Sparkles,
  Zap, Database, Clock, Send, Copy, GitCompare,
} from 'lucide-react';
import { useWalletStore } from '@/lib/store';
import { formatUs, formatBytes, pctUsed } from '@/lib/analyzers/accountResources';
import { analyzeRecentActions, buildCpuPressureSummary } from '@/lib/analyzers/recentActions';
import { generateRecommendations, recommendBatchSize } from '@/lib/analyzers/recommendations';
import { aggregateCleanupOpportunities } from '@/lib/analyzers/ram/cleanupOpportunities';
import type {
  WaxAccount, HyperionAction, AnalyzerResult, Recommendation, AnalyzerSeverity,
  CleanupItem,
} from '@/lib/analyzers/types';
import type { CpuPressureSummary } from '@/lib/analyzers/recentActions';

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<AnalyzerSeverity, string> = {
  ok:       'text-green-400 border-green-500/30 bg-green-500/5',
  info:     'text-blue-400  border-blue-500/30  bg-blue-500/5',
  warning:  'text-amber-400 border-amber-500/30 bg-amber-500/5',
  critical: 'text-red-400   border-red-500/30   bg-red-500/5',
};

const SEVERITY_ICON: Record<AnalyzerSeverity, React.ReactNode> = {
  ok:       <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
  info:     <Info          className="w-4 h-4 text-blue-400  shrink-0" />,
  warning:  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  critical: <AlertCircle   className="w-4 h-4 text-red-400   shrink-0" />,
};

const CONFIDENCE_LABEL: Record<string, { text: string; title: string; color: string }> = {
  confirmed: { text: 'Confirmed',  title: 'Read directly from the blockchain — exact data.',            color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  likely:    { text: 'Likely',     title: 'Based on an indirect query — very probably correct.',        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  inferred:  { text: 'Estimated',  title: 'Approximated from partial data — treat as a rough guide.',   color: 'text-zinc-400  bg-zinc-500/10  border-zinc-500/30'  },
};

function ConfidenceBadge({ level }: { level: string }) {
  const c = CONFIDENCE_LABEL[level] ?? CONFIDENCE_LABEL.inferred;
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-semibold ${c.color}`}
      title={c.title}
    >
      {c.text}
    </span>
  );
}

function severityColor(pct: number): string {
  if (pct > 90) return 'bg-red-500';
  if (pct > 70) return 'bg-amber-500';
  return 'bg-green-500';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResourceBar({
  label, used, max, unit, formatter,
}: {
  label: string; used: number; max: number; unit: string; formatter: (n: number) => string;
}) {
  const pct = max > 0 ? (used / max) * 100 : 0;
  const avail = max - used;
  const color = severityColor(pct);
  return (
    <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-mono ${pct > 90 ? 'text-red-400' : pct > 70 ? 'text-amber-400' : 'text-green-400'}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{formatter(used)} used</span>
        <span className="text-zinc-400">{formatter(avail)} free / {formatter(max)} max</span>
      </div>
      {unit && <p className="text-[11px] text-zinc-600">{unit}</p>}
    </div>
  );
}

function RecommendationItem({ rec }: { rec: Recommendation }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_COLORS[rec.severity]}`}>
      {SEVERITY_ICON[rec.severity]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{rec.text}</p>
        {rec.detail && <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{rec.detail}</p>}
        {rec.action && (
          <p className={`text-xs font-semibold mt-1 ${
            rec.severity === 'critical' ? 'text-red-400' :
            rec.severity === 'warning'  ? 'text-amber-400' : 'text-green-400'
          }`}>→ {rec.action}</p>
        )}
      </div>
    </div>
  );
}

function CleanupCard({ item }: { item: CleanupItem }) {
  const [copied, setCopied] = useState(false);

  const reclaimTag =
    item.reclaimable === 'yes'   ? { text: 'Reclaimable now', color: 'text-green-400 bg-green-500/10 border-green-500/30' } :
    item.reclaimable === 'maybe' ? { text: 'Possibly reclaimable', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' } :
                                   { text: 'Usually permanent', color: 'text-zinc-500 bg-zinc-700/40 border-zinc-600/40' };

  const payerLabel =
    item.payer === 'me'       ? 'You pay RAM' :
    item.payer === 'contract' ? 'Contract pays RAM' :
    item.payer === 'other'    ? 'Another account pays' : 'RAM payer unknown';

  const copyIds = item.actionLinks.find(l => l.kind === 'copy');

  const handleCopy = () => {
    if (!copyIds?.copyValue) return;
    navigator.clipboard.writeText(copyIds.copyValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/60 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold text-white">{item.title}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${reclaimTag.color}`}>
          {reclaimTag.text}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider">Size</p>
          <p className="text-zinc-200 font-mono font-semibold">~{formatBytes(item.estimatedBytes)}</p>
        </div>
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider">Rows</p>
          <p className="text-zinc-200 font-mono">{item.count.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider">Who pays</p>
          <p className={`font-medium ${item.payer === 'me' ? 'text-amber-300' : 'text-zinc-400'}`}>{payerLabel}</p>
        </div>
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider">Data quality</p>
          <ConfidenceBadge level={item.confidence} />
        </div>
      </div>

      {/* How to reclaim */}
      {item.howToReclaim && (
        <p className="text-xs text-zinc-500 border-l-2 border-zinc-700 pl-2.5 leading-relaxed">
          <span className="text-zinc-400 font-medium">How to reclaim:</span> {item.howToReclaim}
        </p>
      )}

      {/* Action buttons */}
      {(item.actionLinks.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {item.actionLinks.filter(l => l.kind !== 'copy').map((link, i) => (
            <a
              key={i}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {link.label}
            </a>
          ))}
          {copyIds && (
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 hover:text-white transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : copyIds.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AnalyzerSection({ result }: { result: AnalyzerResult }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors"
      >
        {SEVERITY_ICON[result.severity]}
        <div className="flex-1 text-left">
          <span className="text-sm font-semibold text-white">{result.title}</span>
          {result.description && (
            <span className="text-xs text-zinc-500 ml-2">{result.description}</span>
          )}
        </div>
        <ConfidenceBadge level={result.confidence} />
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800">
          {result.error && (
            <div className="px-4 py-3 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {result.error}
            </div>
          )}

          {result.rows.length > 0 && (
            <div className="divide-y divide-zinc-800/60">
              {result.rows.map((row, i) => (
                <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5">
                  <span className="text-xs text-zinc-400 flex-shrink-0 w-56 leading-relaxed">{row.label}</span>
                  <span className={`text-xs font-mono font-semibold shrink-0 ${
                    row.value === 'error' ? 'text-red-400' :
                    typeof row.value === 'number' && row.value > 0 ? 'text-amber-300' :
                    typeof row.value === 'number' ? 'text-zinc-500' :
                    'text-white'
                  }`}>
                    {String(row.value)}
                  </span>
                  {row.detail && (
                    <span className="text-xs text-zinc-600 text-right leading-relaxed flex-1">{row.detail}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.notes && (
            <div className="px-4 py-2.5 border-t border-zinc-800 flex items-start gap-2 text-xs text-zinc-500 italic">
              <Info className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
              {result.notes}
            </div>
          )}

          {result.cleanupItems && result.cleanupItems.length > 0 && (
            <div className="p-4 border-t border-zinc-800 flex flex-col gap-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Cleanup Actions</p>
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

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-zinc-800">{icon}</div>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Simple summary section ────────────────────────────────────────────────────

function SimpleSummary({
  account, cleanupSummary, batchSize, cpuPct, ramPct,
}: {
  account: WaxAccount;
  cleanupSummary: ReturnType<typeof aggregateCleanupOpportunities> | null;
  batchSize: number;
  cpuPct: number;
  ramPct: number;
}) {
  const bullets: Array<{ icon: React.ReactNode; text: string; sub?: string }> = [];

  // Batch transfer readiness
  if (cpuPct > 95) {
    bullets.push({
      icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
      text: 'CPU is critically exhausted — do not start bulk transfers right now.',
      sub: 'Run a PowerUp first, or wait for the 24-hour window to reset.',
    });
  } else if (cpuPct > 75) {
    bullets.push({
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
      text: `CPU is under pressure — limit transfers to about ${batchSize} assets per transaction.`,
    });
  } else {
    bullets.push({
      icon: <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
      text: `CPU is healthy — you can safely bulk-transfer about ${batchSize} assets per transaction.`,
    });
  }

  // RAM status
  if (ramPct > 95) {
    bullets.push({
      icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
      text: 'RAM is critically full — your wallet cannot receive new tokens or NFTs until you free some up.',
      sub: 'Cancel open marketplace listings or P2P offers to recover RAM.',
    });
  } else if (ramPct > 75) {
    bullets.push({
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
      text: `RAM is getting tight (${ramPct.toFixed(0)}% used). Consider cleaning up old listings or open offers.`,
    });
  } else {
    bullets.push({
      icon: <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
      text: `RAM is in good shape — ${(100 - ramPct).toFixed(0)}% free.`,
    });
  }

  // Top reclaimable item
  if (cleanupSummary && cleanupSummary.reclaimable.length > 0) {
    const top = cleanupSummary.reclaimable[0];
    const confirmed = cleanupSummary.reclaimable.filter(c => c.reclaimable === 'yes');
    bullets.push({
      icon: <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />,
      text: `Your main reclaimable RAM: "${top.title}" — ~${formatBytes(top.estimatedBytes)}.`,
      sub: confirmed.length > 0
        ? `${confirmed.length} item${confirmed.length > 1 ? 's' : ''} can be freed now. See "Where Your RAM Is Going" below.`
        : 'May require asset owners to take action. See details below.',
    });
  }

  // Pending refund
  if (account.refund_request) {
    bullets.push({
      icon: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
      text: 'You have a pending CPU/NET unstake refund. It will arrive in your account automatically after 3 days.',
    });
  }

  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        What you can do right now
      </p>
      <div className="flex flex-col gap-3">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {b.icon}
            <div>
              <p className="text-sm text-zinc-200">{b.text}</p>
              {b.sub && <p className="text-xs text-zinc-500 mt-0.5">{b.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top RAM Consumers section ─────────────────────────────────────────────────

function TopRamConsumers({
  cleanupSummary,
}: {
  cleanupSummary: ReturnType<typeof aggregateCleanupOpportunities>;
}) {
  const all = [
    ...cleanupSummary.reclaimable,
    ...cleanupSummary.notReclaimable,
  ].sort((a, b) => b.estimatedBytes - a.estimatedBytes);

  if (all.length === 0) return null;

  const reclaimableNow = all.filter(c => c.reclaimable === 'yes');
  const maybeReclaimable = all.filter(c => c.reclaimable === 'maybe');
  const permanent = all.filter(c => c.reclaimable === 'no');

  return (
    <div>
      <SectionHeader
        icon={<Database className="w-4 h-4 text-amber-400" />}
        title="Where Your RAM Is Going"
        subtitle={`${all.length} categories · ~${formatBytes(all.reduce((s, c) => s + c.estimatedBytes, 0))} total tracked`}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <span className="flex items-center gap-1.5 text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          Reclaimable now ({reclaimableNow.length})
        </span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          Possibly reclaimable ({maybeReclaimable.length})
        </span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" />
          Usually permanent ({permanent.length})
        </span>
      </div>

      {/* Reclaimable now */}
      {reclaimableNow.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Reclaimable Now
          </p>
          <div className="flex flex-col gap-2">
            {reclaimableNow.map(item => <CleanupCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Possibly reclaimable */}
      {maybeReclaimable.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Possibly Reclaimable
          </p>
          <div className="flex flex-col gap-2">
            {maybeReclaimable.map(item => <CleanupCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Permanent / informational */}
      {permanent.length > 0 && (
        <details className="group">
          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors select-none flex items-center gap-1.5 py-1">
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
            {permanent.length} permanent or informational item{permanent.length > 1 ? 's' : ''} — not worth acting on
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {permanent.map(item => <CleanupCard key={item.id} item={item} />)}
          </div>
        </details>
      )}
    </div>
  );
}

// ── CPU Pressure Summary section ──────────────────────────────────────────────

function CpuPressureSection({ summary }: { summary: CpuPressureSummary }) {
  if (summary.groups.length === 0) return null;

  const topGroup = summary.groups[0];

  return (
    <div>
      <SectionHeader
        icon={<Zap className="w-4 h-4 text-amber-400" />}
        title="Recent CPU Pressure"
        subtitle={`Last ${summary.actionCount} actions · ${summary.totalVisibleUs > 0 ? `${formatUs(summary.totalVisibleUs)} total visible CPU` : 'CPU data incomplete'}`}
      />

      {/* Top-level interpretation */}
      {summary.mainDriver && topGroup.count > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-zinc-300">{topGroup.interpretation}</p>
        </div>
      )}

      {/* Groups table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 divide-y divide-zinc-800/60">
          {/* Header */}
          <div className="col-span-4 grid grid-cols-[1fr_auto_auto_auto] px-4 py-2 bg-zinc-900/80">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Action type</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider text-right pr-6">Count</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider text-right pr-6">Avg CPU</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider text-right">Total CPU</span>
          </div>

          {summary.groups.map((g, i) => (
            <div
              key={g.category}
              className={`col-span-4 grid grid-cols-[1fr_auto_auto_auto] px-4 py-2.5 ${i % 2 === 0 ? 'bg-zinc-900/40' : ''}`}
            >
              <div>
                <span className="text-sm text-zinc-300">{g.category}</span>
                {g.missingCpuCount > 0 && (
                  <span className="ml-2 text-[10px] text-zinc-600">
                    ({g.missingCpuCount} without data)
                  </span>
                )}
              </div>
              <span className="text-sm font-mono text-zinc-400 text-right pr-6">{g.count}</span>
              <span className="text-sm font-mono text-zinc-400 text-right pr-6">
                {g.avgCpuUs != null ? formatUs(g.avgCpuUs) : '—'}
              </span>
              <span className="text-sm font-mono text-zinc-300 text-right">
                {g.totalCpuUs > 0 ? formatUs(g.totalCpuUs) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {summary.hasMissingData && (
        <p className="mt-2 text-xs text-zinc-600 flex items-center gap-1.5">
          <Info className="w-3 h-3 text-blue-400/60" />
          Some actions have no CPU data. This is a history node limitation for older records, not missing transactions.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const { connectedAccount } = useWalletStore();
  const searchParams = useSearchParams();

  const [inputAccount, setInputAccount] = useState('');
  const [analyzedAccount, setAnalyzedAccount] = useState<string | null>(null);
  const didAutoAnalyze = useRef(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [accountData, setAccountData] = useState<WaxAccount | null>(null);
  const [historyData, setHistoryData] = useState<{
    actions: HyperionAction[];
    total: number;
    endpoint: string | null;
    warning?: string;
  } | null>(null);
  const [ramData, setRamData] = useState<AnalyzerResult[] | null>(null);

  const [loadingAccount, setLoadingAccount] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingRam,     setLoadingRam]     = useState(false);
  const [errorAccount,   setErrorAccount]   = useState<string | null>(null);
  const [errorHistory,   setErrorHistory]   = useState<string | null>(null);

  const analyze = useCallback(async (account: string, refresh = false) => {
    const trimmed = account.trim().toLowerCase();
    if (!trimmed) return;

    setAnalyzedAccount(trimmed);
    setLastRefresh(new Date());
    setAccountData(null); setHistoryData(null); setRamData(null);
    setErrorAccount(null); setErrorHistory(null);
    setLoadingAccount(true); setLoadingHistory(true); setLoadingRam(true);

    const qs = (extra = '') => `?account=${encodeURIComponent(trimmed)}${refresh ? '&refresh=true' : ''}${extra}`;

    const [accountP, historyP, ramP] = [
      fetch(`/api/chain/account${qs()}`),
      fetch(`/api/chain/history${qs('&limit=50')}`),
      fetch(`/api/chain/ram${qs()}`),
    ];

    accountP.then(async res => {
      const json = await res.json() as { success: boolean; data?: WaxAccount; error?: string };
      if (json.success && json.data) setAccountData(json.data);
      else setErrorAccount(json.error ?? 'Failed to load account');
    }).catch(e => setErrorAccount(String(e))).finally(() => setLoadingAccount(false));

    historyP.then(async res => {
      const json = await res.json() as {
        success: boolean;
        data?: { actions: HyperionAction[]; total: number; endpoint: string | null };
        warning?: string; error?: string;
      };
      if (json.success && json.data) setHistoryData({ ...json.data, warning: json.warning });
      else setErrorHistory(json.error ?? 'History unavailable');
    }).catch(e => setErrorHistory(String(e))).finally(() => setLoadingHistory(false));

    ramP.then(async res => {
      const json = await res.json() as { success: boolean; data?: AnalyzerResult[]; error?: string };
      if (json.success && json.data) setRamData(json.data);
    }).catch(() => {}).finally(() => setLoadingRam(false));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze(inputAccount || connectedAccount || '');
  };

  const refresh = () => { if (analyzedAccount) analyze(analyzedAccount, true); };

  // ── Auto-analyze from URL query param on mount ─────────────────────────────
  // Enables "Full analysis →" links from /resources/compare to land pre-loaded.
  useEffect(() => {
    if (didAutoAnalyze.current) return;
    const urlAccount = searchParams.get('account');
    if (urlAccount) {
      didAutoAnalyze.current = true;
      setInputAccount(urlAccount);
      analyze(urlAccount);
    }
  }, [searchParams, analyze]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const actionsResult   = historyData ? analyzeRecentActions(historyData.actions) : null;
  const cpuPressure     = historyData ? buildCpuPressureSummary(historyData.actions) : null;
  const ramSuspectCount = ramData
    ? ramData.flatMap(r => r.rows)
        .filter(row => typeof row.value === 'number' && row.value > 0)
        .reduce((s, row) => s + (typeof row.value === 'number' ? row.value : 0), 0)
    : 0;
  const recommendations = accountData && historyData
    ? generateRecommendations(accountData, historyData.actions, ramSuspectCount)
    : [];
  const cleanupSummary = ramData ? aggregateCleanupOpportunities(ramData) : null;

  const cpuPct  = accountData ? pctUsed(accountData.cpu_limit) : 0;
  const ramPct  = accountData ? pctUsed({ used: accountData.ram_usage, max: accountData.ram_quota }) : 0;
  const batch   = accountData ? recommendBatchSize(accountData.cpu_limit.available) : 0;

  const isAnalyzing = loadingAccount || loadingHistory || loadingRam;
  const hasAnyData  = accountData || historyData || ramData;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 py-4">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-amber-400" />
          WAX Resource Inspector
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          CPU, NET, and RAM breakdown for any WAX wallet — with actionable cleanup and transfer readiness.
        </p>
      </div>

      {/* Account selector */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            value={inputAccount}
            onChange={e => setInputAccount(e.target.value.trim().toLowerCase())}
            placeholder={connectedAccount ?? 'Enter WAX account (e.g. alice.wam)'}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
        {connectedAccount && inputAccount !== connectedAccount && (
          <button
            type="button"
            onClick={() => { setInputAccount(connectedAccount); analyze(connectedAccount); }}
            className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-amber-400 hover:bg-zinc-700 transition-colors whitespace-nowrap"
          >
            Use mine
          </button>
        )}
        <button
          type="submit"
          disabled={isAnalyzing && !hasAnyData}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {isAnalyzing && !hasAnyData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Analyze
        </button>
      </form>

      {/* Empty state */}
      {!hasAnyData && !isAnalyzing && !analyzedAccount && (
        <div className="text-center py-20 text-zinc-600">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Enter a WAX account and click Analyze.</p>
          {connectedAccount && (
            <button
              onClick={() => { setInputAccount(connectedAccount); analyze(connectedAccount); }}
              className="mt-4 text-amber-400 hover:text-amber-300 text-sm"
            >
              Analyze my wallet ({connectedAccount})
            </button>
          )}
          {/* Quick link to collection inspector */}
          <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
            <p className="text-xs text-zinc-600 mb-2">Are you a collection owner or authorized account?</p>
            <Link
              href="/collections"
              className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Layers className="w-4 h-4" />
              Inspect a Collection's RAM obligations
            </Link>
          </div>
        </div>
      )}

      {/* Account error */}
      {errorAccount && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-red-300 font-medium">Could not load account</p>
            <p className="text-xs text-red-400 mt-0.5">{errorAccount}</p>
          </div>
        </div>
      )}

      {/* Section header bar */}
      {(hasAnyData || isAnalyzing) && analyzedAccount && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">
              Analyzing <span className="font-mono text-amber-400">{analyzedAccount}</span>
            </p>
            {lastRefresh && (
              <p className="text-xs text-zinc-600 mt-0.5">Last refreshed {lastRefresh.toLocaleTimeString()}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/resources/compare"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <GitCompare className="w-3 h-3" />
              Compare Wallets
            </Link>
            <Link
              href="/collections"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <Layers className="w-3 h-3" />
              Inspect a Collection
            </Link>
            <button
              onClick={refresh}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
            >
              {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* ── SECTION 0: Simple summary ─────────────────────────────────────── */}
      {accountData && (
        <SimpleSummary
          account={accountData}
          cleanupSummary={cleanupSummary}
          batchSize={batch}
          cpuPct={cpuPct}
          ramPct={ramPct}
        />
      )}

      {/* ── SECTION 1: Resource Overview ─────────────────────────────────── */}
      {(accountData || loadingAccount) && (
        <div>
          <SectionHeader
            icon={<Zap className="w-4 h-4 text-amber-400" />}
            title="Resource Overview"
            subtitle="Live from the WAX blockchain — refreshes on demand"
          />

          {loadingAccount && !accountData && (
            <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading account data…
            </div>
          )}

          {accountData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ResourceBar label="CPU" used={accountData.cpu_limit.used} max={accountData.cpu_limit.max}
                formatter={formatUs} unit={`${formatUs(accountData.cpu_limit.available)} available`} />
              <ResourceBar label="NET" used={accountData.net_limit.used} max={accountData.net_limit.max}
                formatter={formatBytes} unit={`${formatBytes(accountData.net_limit.available)} available`} />
              <ResourceBar label="RAM" used={accountData.ram_usage} max={accountData.ram_quota}
                formatter={formatBytes} unit={`${formatBytes(accountData.ram_quota - accountData.ram_usage)} free`} />
            </div>
          )}

          {accountData && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {accountData.self_delegated_bandwidth && (
                <>
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Staked CPU</p>
                    <p className="text-sm font-mono text-white mt-0.5">{accountData.self_delegated_bandwidth.cpu_weight}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Staked NET</p>
                    <p className="text-sm font-mono text-white mt-0.5">{accountData.self_delegated_bandwidth.net_weight}</p>
                  </div>
                </>
              )}
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">CPU this window</p>
                <p className="text-sm font-mono text-white mt-0.5">{cpuPct.toFixed(1)}% used</p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">RAM used</p>
                <p className="text-sm font-mono text-white mt-0.5">
                  {formatBytes(accountData.ram_usage)} / {formatBytes(accountData.ram_quota)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 2: Top RAM Consumers ─────────────────────────────────── */}
      {cleanupSummary && (cleanupSummary.reclaimable.length > 0 || cleanupSummary.notReclaimable.length > 0) && (
        <TopRamConsumers cleanupSummary={cleanupSummary} />
      )}

      {loadingRam && !ramData && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Scanning contract tables for RAM usage…
        </div>
      )}

      {/* ── SECTION 3: Bulk Transfer Diagnostics ─────────────────────────── */}
      {accountData && (
        <div>
          <SectionHeader
            icon={<Send className="w-4 h-4 text-amber-400" />}
            title="Bulk Transfer Diagnostics"
            subtitle="Practical transfer readiness based on current resources"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Recommended Batch Size</p>
              <p className="text-3xl font-bold text-white">{batch}</p>
              <p className="text-xs text-zinc-500 mt-1">assets per transaction</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">CPU Available</p>
              <p className={`text-3xl font-bold font-mono ${
                cpuPct > 90 ? 'text-red-400' : cpuPct > 70 ? 'text-amber-400' : 'text-green-400'
              }`}>
                {formatUs(accountData.cpu_limit.available)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">~{batch} assets safely</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">RAM Free</p>
              <p className={`text-3xl font-bold font-mono ${
                ramPct > 90 ? 'text-red-400' : ramPct > 70 ? 'text-amber-400' : 'text-green-400'
              }`}>
                {formatBytes(accountData.ram_quota - accountData.ram_usage)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{(100 - ramPct).toFixed(1)}% remaining</p>
            </div>
          </div>
          <div className="mt-3">
            <Link
              href="/transfer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Open Bulk Transfer Tool
            </Link>
          </div>
        </div>
      )}

      {/* ── SECTION 4: CPU Pressure + Recent Activity ────────────────────── */}
      <div>
        <SectionHeader
          icon={<Clock className="w-4 h-4 text-amber-400" />}
          title="Recent Activity"
          subtitle={historyData?.endpoint ? `Source: ${historyData.endpoint}` : 'Hyperion v2 history'}
        />

        {loadingHistory && !historyData && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading transaction history…
          </div>
        )}

        {errorHistory && (
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-zinc-600" />
            {errorHistory}
          </div>
        )}

        {historyData?.warning && (
          <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {historyData.warning}
          </div>
        )}

        {/* CPU pressure summary */}
        {cpuPressure && cpuPressure.groups.length > 0 && (
          <div className="mb-4">
            <CpuPressureSection summary={cpuPressure} />
          </div>
        )}

        {/* Detailed action list */}
        {actionsResult && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Full Transaction Log</p>
            <AnalyzerSection result={actionsResult} />
          </div>
        )}

        {historyData && historyData.actions.length === 0 && !loadingHistory && (
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-500">
            No recent actions found for this account.
          </div>
        )}
      </div>

      {/* ── SECTION 5: Recommendations ───────────────────────────────────── */}
      {recommendations.length > 0 && (
        <div>
          <SectionHeader
            icon={<Sparkles className="w-4 h-4 text-amber-400" />}
            title="All Recommendations"
            subtitle="Heuristic analysis — treat as guidance, not guarantees"
          />
          <div className="flex flex-col gap-2">
            {recommendations.map(rec => (
              <RecommendationItem key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 6: RAM Suspects (detailed) ───────────────────────────── */}
      {(ramData || (loadingRam && analyzedAccount)) && (
        <div>
          <SectionHeader
            icon={<Database className="w-4 h-4 text-amber-400" />}
            title="RAM Suspects — Detailed View"
            subtitle="On-chain table queries for this wallet"
          />

          <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-500">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
            <span>
              Each section is labelled{' '}
              <span className="text-green-400 font-semibold">Confirmed</span>{' '}
              (exact blockchain data),{' '}
              <span className="text-amber-400 font-semibold">Likely</span>{' '}
              (indirect query, very probably correct), or{' '}
              <span className="text-zinc-400 font-semibold">Estimated</span>{' '}
              (approximate — treat as a rough guide).
            </span>
          </div>

          {ramData && (
            <div className="flex flex-col gap-3">
              {ramData.map(result => (
                <AnalyzerSection key={result.id} result={result} />
              ))}
            </div>
          )}

          {!ramData && !loadingRam && analyzedAccount && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-500">
              RAM analysis unavailable.
            </div>
          )}
        </div>
      )}

      {/* Collection inspector CTA */}
      {hasAnyData && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-4">
          <Layers className="w-8 h-8 text-amber-400/40 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Collection Owner?</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              If you run a WAX NFT collection, inspect your collection's RAM obligations — schemas, templates, and minted assets.
            </p>
          </div>
          <Link
            href="/collections"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" />
            Inspect a Collection
          </Link>
        </div>
      )}

    </div>
  );
}
