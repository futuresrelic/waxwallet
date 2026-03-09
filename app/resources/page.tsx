'use client';
// ─── WAX Resource Inspector / Task Manager ───────────────────────────────────
// Shows CPU / NET / RAM health, recent activity clues, RAM suspects, and
// actionable recommendations for any WAX wallet.

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Info, Loader2, RefreshCw, Search, Zap, Database, Clock, Send,
} from 'lucide-react';
import { useWalletStore } from '@/lib/store';
import { parseAccountResources, formatUs, formatBytes, pctUsed } from '@/lib/analyzers/accountResources';
import { analyzeRecentActions }    from '@/lib/analyzers/recentActions';
import { generateRecommendations, recommendBatchSize } from '@/lib/analyzers/recommendations';
import type {
  WaxAccount, HyperionAction, AnalyzerResult, Recommendation, AnalyzerSeverity,
} from '@/lib/analyzers/types';

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<AnalyzerSeverity, string> = {
  ok:       'text-green-400 border-green-500/30 bg-green-500/5',
  info:     'text-blue-400  border-blue-500/30  bg-blue-500/5',
  warning:  'text-amber-400 border-amber-500/30 bg-amber-500/5',
  critical: 'text-red-400   border-red-500/30   bg-red-500/5',
};

const SEVERITY_BAR: Record<AnalyzerSeverity, string> = {
  ok:       'bg-green-500',
  info:     'bg-blue-500',
  warning:  'bg-amber-500',
  critical: 'bg-red-500',
};

const SEVERITY_ICON: Record<AnalyzerSeverity, React.ReactNode> = {
  ok:       <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
  info:     <Info          className="w-4 h-4 text-blue-400  shrink-0" />,
  warning:  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  critical: <AlertCircle   className="w-4 h-4 text-red-400   shrink-0" />,
};

function severityColor(pct: number): string {
  if (pct > 90) return 'bg-red-500';
  if (pct > 70) return 'bg-amber-500';
  return 'bg-green-500';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResourceBar({
  label, used, max, unit, formatter,
}: {
  label: string;
  used: number;
  max: number;
  unit: string;
  formatter: (n: number) => string;
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
          }`}>
            → {rec.action}
          </p>
        )}
      </div>
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
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-semibold ${SEVERITY_COLORS[result.severity]}`}>
          {result.confidence}
        </span>
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
            <div className="px-4 py-2.5 border-t border-zinc-800 text-xs text-zinc-500 italic">
              {result.notes}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const { connectedAccount } = useWalletStore();

  const [inputAccount, setInputAccount] = useState('');
  const [analyzedAccount, setAnalyzedAccount] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [accountData, setAccountData] = useState<WaxAccount | null>(null);
  const [historyData, setHistoryData] = useState<{
    actions: HyperionAction[];
    total: number;
    endpoint: string | null;
    warning?: string;
  } | null>(null);
  const [ramData, setRamData] = useState<AnalyzerResult[] | null>(null);

  // ── Loading / error state ──────────────────────────────────────────────────
  const [loadingAccount,  setLoadingAccount]  = useState(false);
  const [loadingHistory,  setLoadingHistory]  = useState(false);
  const [loadingRam,      setLoadingRam]      = useState(false);
  const [errorAccount,    setErrorAccount]    = useState<string | null>(null);
  const [errorHistory,    setErrorHistory]    = useState<string | null>(null);

  // ── Analyze ────────────────────────────────────────────────────────────────

  const analyze = useCallback(async (account: string, refresh = false) => {
    const trimmed = account.trim().toLowerCase();
    if (!trimmed) return;

    setAnalyzedAccount(trimmed);
    setLastRefresh(new Date());

    // Reset
    setAccountData(null);
    setHistoryData(null);
    setRamData(null);
    setErrorAccount(null);
    setErrorHistory(null);
    setLoadingAccount(true);
    setLoadingHistory(true);
    setLoadingRam(true);

    const qs = (extra = '') => `?account=${encodeURIComponent(trimmed)}${refresh ? '&refresh=true' : ''}${extra}`;

    // Fire all three fetches in parallel
    const [accountP, historyP, ramP] = [
      fetch(`/api/chain/account${qs()}`),
      fetch(`/api/chain/history${qs('&limit=50')}`),
      fetch(`/api/chain/ram${qs()}`),
    ];

    // ── Account ──────────────────────────────────────────────────────────────
    accountP.then(async res => {
      const json = await res.json() as { success: boolean; data?: WaxAccount; error?: string };
      if (json.success && json.data) setAccountData(json.data);
      else setErrorAccount(json.error ?? 'Failed to load account');
    }).catch(e => setErrorAccount(String(e)))
      .finally(() => setLoadingAccount(false));

    // ── History ───────────────────────────────────────────────────────────────
    historyP.then(async res => {
      const json = await res.json() as {
        success: boolean;
        data?: { actions: HyperionAction[]; total: number; endpoint: string | null };
        warning?: string;
        error?: string;
      };
      if (json.success && json.data) {
        setHistoryData({ ...json.data, warning: json.warning });
      } else {
        setErrorHistory(json.error ?? 'History unavailable');
      }
    }).catch(e => setErrorHistory(String(e)))
      .finally(() => setLoadingHistory(false));

    // ── RAM ───────────────────────────────────────────────────────────────────
    ramP.then(async res => {
      const json = await res.json() as { success: boolean; data?: AnalyzerResult[]; error?: string };
      if (json.success && json.data) setRamData(json.data);
    }).catch(() => { /* RAM section will just show nothing */ })
      .finally(() => setLoadingRam(false));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze(inputAccount || connectedAccount || '');
  };

  const refresh = () => {
    if (analyzedAccount) analyze(analyzedAccount, true);
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const resourceResult  = accountData ? parseAccountResources(accountData)          : null;
  const actionsResult   = historyData  ? analyzeRecentActions(historyData.actions)  : null;
  const ramSuspectCount = ramData
    ? ramData.flatMap(r => r.rows)
        .filter(row => typeof row.value === 'number' && row.value > 0)
        .reduce((s, row) => s + (typeof row.value === 'number' ? row.value : 0), 0)
    : 0;
  const recommendations = accountData && historyData
    ? generateRecommendations(accountData, historyData.actions, ramSuspectCount)
    : [];

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
          CPU, NET, and RAM health for any WAX wallet — with RAM suspects, recent pressure, and transfer recommendations.
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
          {isAnalyzing && !hasAnyData
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Activity className="w-4 h-4" />}
          Analyze
        </button>
      </form>

      {/* No data state */}
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
        </div>
      )}

      {/* Error: account not found */}
      {errorAccount && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-red-300 font-medium">Could not load account</p>
            <p className="text-xs text-red-400 mt-0.5">{errorAccount}</p>
          </div>
        </div>
      )}

      {/* ── Section header bar ────────────────────────────────────────────── */}
      {(hasAnyData || isAnalyzing) && analyzedAccount && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">
              Analyzing <span className="font-mono text-amber-400">{analyzedAccount}</span>
            </p>
            {lastRefresh && (
              <p className="text-xs text-zinc-600 mt-0.5">
                Last refreshed {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
          >
            {isAnalyzing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      )}

      {/* ── SECTION 1: Resource Overview ─────────────────────────────────── */}
      {(accountData || loadingAccount) && (
        <div>
          <SectionHeader
            icon={<Zap className="w-4 h-4 text-amber-400" />}
            title="Resource Overview"
            subtitle="Confirmed — live from WAX RPC get_account"
          />

          {loadingAccount && !accountData && (
            <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading account data…
            </div>
          )}

          {accountData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ResourceBar
                label="CPU"
                used={accountData.cpu_limit.used}
                max={accountData.cpu_limit.max}
                formatter={formatUs}
                unit={`${formatUs(accountData.cpu_limit.available)} available`}
              />
              <ResourceBar
                label="NET"
                used={accountData.net_limit.used}
                max={accountData.net_limit.max}
                formatter={formatBytes}
                unit={`${formatBytes(accountData.net_limit.available)} available`}
              />
              <ResourceBar
                label="RAM"
                used={accountData.ram_usage}
                max={accountData.ram_quota}
                formatter={formatBytes}
                unit={`${formatBytes(accountData.ram_quota - accountData.ram_usage)} free`}
              />
            </div>
          )}

          {accountData && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {accountData.self_delegated_bandwidth && (
                <>
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Staked CPU</p>
                    <p className="text-sm font-mono text-white mt-0.5">
                      {accountData.self_delegated_bandwidth.cpu_weight}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Staked NET</p>
                    <p className="text-sm font-mono text-white mt-0.5">
                      {accountData.self_delegated_bandwidth.net_weight}
                    </p>
                  </div>
                </>
              )}
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">CPU Window</p>
                <p className="text-sm font-mono text-white mt-0.5">
                  {pctUsed(accountData.cpu_limit).toFixed(1)}% used
                </p>
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

      {/* ── SECTION 2: Recommendations ───────────────────────────────────── */}
      {recommendations.length > 0 && (
        <div>
          <SectionHeader
            icon={<CheckCircle2 className="w-4 h-4 text-amber-400" />}
            title="Recommendations"
            subtitle="Heuristic analysis — treat as guidance, not guarantees"
          />
          <div className="flex flex-col gap-2">
            {recommendations.map(rec => (
              <RecommendationItem key={rec.id} rec={rec} />
            ))}
          </div>
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
            {/* Recommended batch size */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Recommended Batch Size</p>
              <p className="text-3xl font-bold text-white">
                {recommendBatchSize(accountData.cpu_limit.available)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">assets per transaction</p>
            </div>
            {/* CPU available */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">CPU Available</p>
              <p className={`text-3xl font-bold font-mono ${
                pctUsed(accountData.cpu_limit) > 90 ? 'text-red-400' :
                pctUsed(accountData.cpu_limit) > 70 ? 'text-amber-400' : 'text-green-400'
              }`}>
                {formatUs(accountData.cpu_limit.available)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                ~{recommendBatchSize(accountData.cpu_limit.available)} assets safely
              </p>
            </div>
            {/* RAM headroom */}
            {(() => {
              const ramPct = pctUsed({ used: accountData.ram_usage, max: accountData.ram_quota });
              return (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">RAM Free</p>
                  <p className={`text-3xl font-bold font-mono ${
                    ramPct > 90 ? 'text-red-400' : ramPct > 70 ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {formatBytes(accountData.ram_quota - accountData.ram_usage)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {(100 - ramPct).toFixed(1)}% remaining
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Recent PowerUp history */}
          {historyData && historyData.actions.length > 0 && (() => {
            const recent = historyData.actions.filter(
              a => a.act.account === 'eosio' && a.act.name === 'powerup'
            ).slice(0, 3);
            if (recent.length === 0) return null;
            return (
              <div className="mt-3 p-3 rounded-xl bg-zinc-900 border border-amber-500/20">
                <p className="text-xs text-amber-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Recent PowerUps ({recent.length} found)
                </p>
                <div className="flex flex-col gap-1">
                  {recent.map((a, i) => (
                    <p key={i} className="text-xs text-zinc-500 font-mono">
                      {new Date(a.timestamp).toLocaleString()} · {a.trx_id.slice(0, 12)}…
                      {a.cpu_usage_us != null ? ` · ${formatUs(a.cpu_usage_us)} CPU` : ''}
                    </p>
                  ))}
                </div>
              </div>
            );
          })()}

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

      {/* ── SECTION 4: Recent Activity ────────────────────────────────────── */}
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
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-500">
            <AlertCircle className="w-3.5 h-3.5 text-zinc-600 inline mr-1.5" />
            {errorHistory}
          </div>
        )}

        {historyData?.warning && (
          <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {historyData.warning}
          </div>
        )}

        {actionsResult && (
          <AnalyzerSection result={actionsResult} />
        )}

        {historyData && historyData.actions.length === 0 && !loadingHistory && (
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-500">
            No recent actions found for this account.
          </div>
        )}
      </div>

      {/* ── SECTION 5: RAM Suspects ───────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<Database className="w-4 h-4 text-amber-400" />}
          title="RAM Suspects"
          subtitle="On-chain rows likely consuming this wallet's RAM"
        />

        {loadingRam && !ramData && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanning contract tables…
          </div>
        )}

        <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-500">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
          <span>
            Each section is labelled{' '}
            <span className="text-white font-semibold">confirmed</span>,{' '}
            <span className="text-white font-semibold">likely</span>, or{' '}
            <span className="text-white font-semibold">inferred</span>{' '}
            to indicate data precision. Byte estimates are approximate.
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

    </div>
  );
}
