'use client';
// ─── Bulk Asset Transfer Tool ─────────────────────────────────────────────────
// Transfers all (or selected) NFTs from a connected WAX wallet to another.
// Sends in configurable batches; auto-PowerUps (bundled in the same tx) if
// CPU/NET limits are hit.

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Send, Zap, Pause, Play, StopCircle, AlertCircle, CheckCircle2,
  Loader2, ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  CheckSquare, Square, RefreshCw, Wallet,
} from 'lucide-react';
import { useWalletStore } from '@/lib/store';
import type { AssetData } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const WAX_ACCOUNT_RE = /^[a-z1-5.]{1,12}([a-z1-5]|[1-5])?$/;

type Step = 'setup' | 'preview' | 'running' | 'done';

const SORT_OPTIONS = [
  { value: 'asset_id:desc', label: 'Newest first' },
  { value: 'asset_id:asc',  label: 'Oldest first' },
  { value: 'template_mint:asc', label: 'Mint # (low→high)' },
  { value: 'template_mint:desc', label: 'Mint # (high→low)' },
  { value: 'name:asc', label: 'Name (A→Z)' },
  { value: 'name:desc', label: 'Name (Z→A)' },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]['value'];

interface LogLine {
  kind: 'info' | 'ok' | 'err' | 'powerup';
  text: string;
  ts: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

/** Fetch every matching asset (auto-paginates, bypasses the 100/page cap). */
async function fetchAllAssets(
  owner: string,
  collections: string[],
  sort: SortValue,
): Promise<AssetData[]> {
  const all: AssetData[] = [];
  let page = 1;
  const limit = 1000;

  while (true) {
    const params = new URLSearchParams({
      owner,
      limit: String(limit),
      page: String(page),
      sort,
      _uncapped: 'true',  // bypass the default 100/page server cap
    });
    if (collections.length > 0) params.set('collection_name', collections.join(','));

    const res = await fetch(`/api/assets?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading assets`);
    const json = await res.json() as { success: boolean; data?: AssetData[]; error?: string };
    if (!json.success) throw new Error(json.error ?? 'Unknown API error');

    const batch = json.data ?? [];
    all.push(...batch);
    if (batch.length < limit) break; // last page reached
    page++;
  }

  // Only show transferable, non-burned assets
  return all.filter(a => a.is_transferable && !a.burned_by_account);
}

/** Fetch collection list for an account. */
async function fetchCollections(owner: string): Promise<string[]> {
  const res = await fetch(`/api/collections?owner=${encodeURIComponent(owner)}&refresh=true`);
  if (!res.ok) return [];
  const json = await res.json() as {
    success: boolean;
    data?: { collections: Array<{ collection: { collection_name: string }; assets: number }> };
  };
  // data is an AccountSummary object: { collections: [{ collection: {...}, assets: N }] }
  return (json.data?.collections ?? []).map(c => c.collection.collection_name);
}

/** Resolve IPFS image URL from an asset. */
function assetThumb(asset: AssetData): string | null {
  const raw = (asset.data?.img ?? asset.data?.image ?? null) as string | null;
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  return `https://ipfs.io/ipfs/${raw}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransferPage() {
  const { connectedAccount } = useWalletStore();
  const [step, setStep] = useState<Step>('setup');

  // ── Setup fields ──────────────────────────────────────────────────────────
  const [sourceWallet, setSourceWallet] = useState('');
  const [destWallet, setDestWallet] = useState('');
  const [memo, setMemo] = useState('Bulk transfer');
  const [batchSize, setBatchSize] = useState(50);
  const [sortValue, setSortValue] = useState<SortValue>('asset_id:desc');
  const [powerUpEnabled, setPowerUpEnabled] = useState(true);
  const [powerUpMax, setPowerUpMax] = useState('1.00000000 WAX');
  const [availableCollections, setAvailableCollections] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Preview ───────────────────────────────────────────────────────────────
  const [allAssets, setAllAssets] = useState<AssetData[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());

  // ── Running ───────────────────────────────────────────────────────────────
  const [transferred, setTransferred] = useState(0);
  const [totalSelected, setTotalSelected] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const stopRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (connectedAccount && !sourceWallet) setSourceWallet(connectedAccount);
  }, [connectedAccount, sourceWallet]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const addLog = useCallback((kind: LogLine['kind'], text: string) => {
    setLog(prev => [...prev, { kind, text, ts: new Date().toLocaleTimeString() }]);
  }, []);

  const loadCollections = async () => {
    const src = sourceWallet.trim();
    if (!WAX_ACCOUNT_RE.test(src)) return;
    setLoadingCollections(true);
    try {
      const cols = await fetchCollections(src);
      setAvailableCollections(cols);
      setSelectedCollections([]);
    } catch {
      setAvailableCollections([]);
    } finally {
      setLoadingCollections(false);
    }
  };

  const loadAssets = async () => {
    setLoadingAssets(true);
    setLoadError('');
    try {
      const assets = await fetchAllAssets(sourceWallet.trim(), selectedCollections, sortValue);
      setAllAssets(assets);
      setSelected(new Set(assets.map(a => a.asset_id)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setLoadingAssets(false);
    }
  };

  const toggleAsset = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCollectionSelection = (col: string) => {
    const ids = allAssets.filter(a => a.collection.collection_name === col).map(a => a.asset_id);
    const allSel = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSel ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleCollectionFilter = (col: string) => {
    setSelectedCollections(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  // ── Transfer runner ───────────────────────────────────────────────────────

  const runTransfer = async () => {
    const { getActiveSession } = await import('@/lib/wallet');
    const session = getActiveSession() as {
      actor: unknown;
      transact: (args: { actions: unknown[] }) => Promise<unknown>;
    } | null;

    if (!session) {
      addLog('err', 'No wallet connected. Please connect your WAX wallet first.');
      return;
    }

    const actor = String(session.actor);
    const dest = destWallet.trim();

    const ids = allAssets.filter(a => selected.has(a.asset_id)).map(a => a.asset_id);
    if (ids.length === 0) { addLog('err', 'No assets selected.'); return; }

    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));

    const total = ids.length;
    setTotalSelected(total);
    setTotalBatches(batches.length);
    setTransferred(0);
    setCurrentBatch(0);
    pausedRef.current = false;
    stopRef.current = false;
    setStep('running');

    addLog('info', `Starting: ${total} assets → ${dest} in ${batches.length} batches (${batchSize}/batch)`);

    let done = 0;

    for (let bi = 0; bi < batches.length; bi++) {
      // Pause / Stop
      while (pausedRef.current && !stopRef.current) {
        await new Promise<void>(r => setTimeout(r, 300));
      }
      if (stopRef.current) {
        addLog('info', `Transfer stopped after ${done}/${total} assets.`);
        return;
      }

      const batch = batches[bi];
      setCurrentBatch(bi + 1);
      addLog('info', `Batch ${bi + 1}/${batches.length}: sending ${batch.length} asset${batch.length > 1 ? 's' : ''}…`);

      // Build the transfer action (reused in all attempts)
      const transferAction = {
        account: 'atomicassets',
        name: 'transfer',
        authorization: [{ actor, permission: 'active' }],
        data: {
          from: actor,
          to: dest,
          asset_ids: batch,
          memo: memo || 'Bulk transfer',
        },
      };

      const powerUpAction = {
        account: 'eosio',
        name: 'powerup',
        authorization: [{ actor, permission: 'active' }],
        data: {
          payer: actor,
          receiver: actor,
          days: 1,
          net_frac: 10000000,   // ~0.001% of NET pool
          cpu_frac: 1000000000, // ~0.1% of CPU pool
          max_payment: powerUpMax,
        },
      };

      let batchDone = false;
      let poweredUp = false;
      let maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts && !batchDone; attempt++) {
        try {
          // On a powerup retry, prepend the powerup action to the SAME transaction
          // so the user sees ONE wallet dialog that includes both actions.
          const actions = poweredUp && attempt > 0
            ? [powerUpAction, transferAction]
            : [transferAction];

          await session.transact({ actions });
          batchDone = true;
          done += batch.length;
          setTransferred(done);
          addLog('ok', `Batch ${bi + 1} ✓ — ${done}/${total} transferred`);

        } catch (err) {
          const msg = String(err).toLowerCase();
          const isResource = msg.includes('cpu') || msg.includes('net') ||
                             msg.includes('resource') || msg.includes('ram');

          if (isResource && powerUpEnabled && !poweredUp) {
            // Flag that next attempt should bundle the PowerUp action
            poweredUp = true;
            maxAttempts++;
            addLog('powerup',
              `Resource limit hit — next attempt will include PowerUp (max ${powerUpMax}) in the same transaction…`
            );
            // Brief pause before retry
            await new Promise<void>(r => setTimeout(r, 500));
          } else {
            const short = String(err).replace(/^Error:\s*/i, '').slice(0, 160);
            addLog('err', `Batch ${bi + 1} (attempt ${attempt + 1}): ${short}`);
            if (attempt < maxAttempts - 1) await new Promise<void>(r => setTimeout(r, 1500));
          }
        }
      }

      if (!batchDone) {
        addLog('err', `Batch ${bi + 1} ultimately failed — skipped ${batch.length} assets.`);
      }

      // Brief pause between successful batches
      if (batchDone && bi < batches.length - 1) {
        await new Promise<void>(r => setTimeout(r, 400));
      }
    }

    addLog('ok', `🎉 Done! ${done} asset${done !== 1 ? 's' : ''} transferred to ${dest}`);
    setStep('done');
  };

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    addLog('info', next ? 'Paused — will resume after current batch.' : 'Resumed.');
  };

  const stopTransfer = () => {
    stopRef.current = true;
    pausedRef.current = false;
    setPaused(false);
  };

  const reset = () => {
    setStep('setup');
    setAllAssets([]);
    setSelected(new Set());
    setLog([]);
    setTransferred(0);
    setCurrentBatch(0);
    setTotalBatches(0);
    setTotalSelected(0);
    setPaused(false);
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const selectedCount = selected.size;
  const batchCount = Math.ceil(selectedCount / batchSize);
  const sourceValid = WAX_ACCOUNT_RE.test(sourceWallet.trim());
  const destValid = WAX_ACCOUNT_RE.test(destWallet.trim());
  const canProceed = sourceValid && destValid && destWallet.trim() !== sourceWallet.trim();

  const byCollection = allAssets.reduce<Record<string, AssetData[]>>((acc, a) => {
    const col = a.collection.collection_name;
    (acc[col] ??= []).push(a);
    return acc;
  }, {});

  const progressPct = totalSelected > 0 ? Math.round((transferred / totalSelected) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 py-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Send className="w-6 h-6 text-amber-400" />
          Bulk Asset Transfer
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Transfer all or selected NFTs from a WAX wallet to another.
          Runs in batches — auto-PowerUps when CPU / NET resources run low.
        </p>
      </div>

      {/* ── STEP 1: SETUP ────────────────────────────────────────────────────── */}
      {step === 'setup' && (
        <div className="flex flex-col gap-6">

          {/* Wallet inputs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-5">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Wallets</h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Source Wallet (from)</label>
              <div className="flex gap-2">
                <input
                  value={sourceWallet}
                  onChange={e => setSourceWallet(e.target.value.trim().toLowerCase())}
                  onBlur={loadCollections}
                  placeholder="e.g. mywallet.wam"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                />
                {connectedAccount && connectedAccount !== sourceWallet && (
                  <button
                    onClick={() => setSourceWallet(connectedAccount)}
                    className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-amber-400 hover:bg-zinc-700 transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    <Wallet className="w-3 h-3" />
                    Use mine
                  </button>
                )}
              </div>
              {sourceWallet && !sourceValid && (
                <p className="text-xs text-red-400">Invalid WAX account name</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Destination Wallet (to)</label>
              <input
                value={destWallet}
                onChange={e => setDestWallet(e.target.value.trim().toLowerCase())}
                placeholder="e.g. recipient.wam"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
              />
              {destWallet && !destValid && (
                <p className="text-xs text-red-400">Invalid WAX account name</p>
              )}
              {destValid && sourceValid && destWallet.trim() === sourceWallet.trim() && (
                <p className="text-xs text-red-400">Source and destination cannot be the same</p>
              )}
            </div>
          </div>

          {/* Collection filter */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Filter by Collection
              </h2>
              <button
                onClick={loadCollections}
                disabled={!sourceValid || loadingCollections}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 disabled:opacity-40"
              >
                {loadingCollections
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RefreshCw className="w-3 h-3" />}
                {loadingCollections ? 'Loading…' : 'Load Collections'}
              </button>
            </div>

            {availableCollections.length === 0 ? (
              <p className="text-xs text-zinc-500">
                {sourceValid
                  ? 'Click "Load Collections" to filter by collection, or leave unfiltered to transfer everything.'
                  : 'Enter a valid source wallet first.'}
              </p>
            ) : (
              <>
                <p className="text-xs text-zinc-500">
                  Click to select specific collections (leave all unselected = transfer everything).
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableCollections.map(col => {
                    const active = selectedCollections.includes(col);
                    return (
                      <button
                        key={col}
                        onClick={() => toggleCollectionFilter(col)}
                        className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                          active
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        {col}
                      </button>
                    );
                  })}
                </div>
                {selectedCollections.length > 0 && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-amber-400">
                      Filtered to {selectedCollections.length} collection{selectedCollections.length > 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => setSelectedCollections([])}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      (clear)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Advanced settings */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-zinc-300 hover:bg-zinc-800/50 transition-colors uppercase tracking-wider"
            >
              Advanced Settings
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="px-6 pb-6 flex flex-col gap-5 border-t border-zinc-800">
                {/* Memo */}
                <div className="flex flex-col gap-1.5 pt-4">
                  <label className="text-xs text-zinc-400">Transfer Memo</label>
                  <input
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="Optional memo attached to each transaction"
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Sort order */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-zinc-400">Sort Order</label>
                  <div className="flex flex-wrap gap-2">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSortValue(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          sortValue === opt.value
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Determines the order assets are transferred — useful when you want oldest / lowest mint first.
                  </p>
                </div>

                {/* Batch size */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-zinc-400">Assets per Transaction</label>
                  <div className="flex gap-2">
                    {[25, 50, 100, 150].map(n => (
                      <button
                        key={n}
                        onClick={() => setBatchSize(n)}
                        className={`px-4 py-1.5 rounded-lg text-sm border transition-colors ${
                          batchSize === n
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Larger batches = fewer transactions but higher CPU cost each.
                  </p>
                </div>

                {/* PowerUp */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPowerUpEnabled(v => !v)}
                      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${powerUpEnabled ? 'bg-amber-500' : 'bg-zinc-700'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${powerUpEnabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Auto PowerUp on CPU / NET limit
                    </span>
                  </div>
                  {powerUpEnabled && (
                    <div className="flex flex-col gap-1.5 pl-13">
                      <label className="text-xs text-zinc-400">Max WAX to spend per PowerUp</label>
                      <input
                        value={powerUpMax}
                        onChange={e => setPowerUpMax(e.target.value)}
                        placeholder="1.00000000 WAX"
                        className="w-56 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <p className="text-xs text-zinc-500">
                        On a CPU/NET error, PowerUp is bundled into the <em>same</em> transaction as the
                        transfer so only one wallet confirmation is needed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Wallet not connected warning */}
          {!connectedAccount && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-300">
                Connect your WAX wallet (top-right) before transferring — you need to sign each transaction.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => { setStep('preview'); loadAssets(); }}
              disabled={!canProceed || !connectedAccount}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Preview Assets
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: PREVIEW ──────────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="flex flex-col gap-6">
          {loadingAssets && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-zinc-400 text-sm">Loading all assets…</p>
            </div>
          )}

          {loadError && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-300 font-medium">Failed to load assets</p>
                <p className="text-xs text-red-400 mt-0.5">{loadError}</p>
              </div>
            </div>
          )}

          {!loadingAssets && !loadError && allAssets.length === 0 && (
            <div className="text-center py-16 text-zinc-500">
              No transferable assets found in this wallet{selectedCollections.length > 0 ? ' for the selected collections' : ''}.
            </div>
          )}

          {!loadingAssets && allAssets.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                <div>
                  <p className="text-white font-semibold">
                    {selectedCount.toLocaleString()} / {allAssets.length.toLocaleString()} assets selected
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {batchCount} transaction{batchCount !== 1 ? 's' : ''} · {batchSize} assets each
                    &nbsp;→&nbsp;
                    <span className="font-mono text-amber-400">{destWallet}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(new Set(allAssets.map(a => a.asset_id)))}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Assets by collection */}
              {Object.entries(byCollection).map(([col, assets]) => {
                const inCol = assets.map(a => a.asset_id);
                const selCount = inCol.filter(id => selected.has(id)).length;
                const collapsed = collapsedCols.has(col);

                return (
                  <div key={col} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
                      <button
                        onClick={() => toggleCollectionSelection(col)}
                        className="text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
                        title={selCount === inCol.length ? 'Deselect all in collection' : 'Select all in collection'}
                      >
                        {selCount === inCol.length
                          ? <CheckSquare className="w-4 h-4 text-amber-400" />
                          : selCount > 0
                          ? <CheckSquare className="w-4 h-4 text-amber-400/50" />
                          : <Square className="w-4 h-4" />}
                      </button>
                      <span className="font-mono text-sm text-white flex-1">{col}</span>
                      <span className="text-xs text-zinc-500">{selCount}/{assets.length} selected</span>
                      <button
                        onClick={() => setCollapsedCols(prev => {
                          const next = new Set(prev);
                          if (next.has(col)) next.delete(col); else next.add(col);
                          return next;
                        })}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>

                    {!collapsed && (
                      <div className="p-3 grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                        {assets.map(asset => {
                          const thumb = assetThumb(asset);
                          const isSel = selected.has(asset.asset_id);
                          return (
                            <button
                              key={asset.asset_id}
                              onClick={() => toggleAsset(asset.asset_id)}
                              title={`${asset.name}${asset.template_mint ? ` #${asset.template_mint}` : ''}`}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                isSel
                                  ? 'border-amber-500 opacity-100'
                                  : 'border-zinc-700 opacity-40 hover:opacity-60'
                              }`}
                            >
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={thumb}
                                  alt={asset.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 text-[10px]">
                                  NFT
                                </div>
                              )}
                              {isSel && (
                                <div className="absolute top-0.5 right-0.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 drop-shadow" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Nav buttons */}
          <div className="flex justify-between gap-3">
            <button
              onClick={() => setStep('setup')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={runTransfer}
              disabled={selectedCount === 0 || loadingAssets}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Transfer {selectedCount > 0 ? `${selectedCount.toLocaleString()} assets` : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: RUNNING / DONE ────────────────────────────────────────────── */}
      {(step === 'running' || step === 'done') && (
        <div className="flex flex-col gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                {step === 'done' ? 'Transfer Complete' : 'Transferring…'}
              </h2>
              {step === 'done' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                <span>{transferred.toLocaleString()} / {totalSelected.toLocaleString()} assets</span>
                <span>
                  {step === 'running'
                    ? `Batch ${currentBatch} of ${totalBatches}`
                    : `${totalBatches} batch${totalBatches !== 1 ? 'es' : ''} completed`}
                </span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-right text-xs text-zinc-500 mt-1">{progressPct}%</div>
            </div>

            {step === 'running' && (
              <div className="flex gap-3">
                <button
                  onClick={togglePause}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  {paused ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
                </button>
                <button
                  onClick={stopTransfer}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-700 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Stop
                </button>
              </div>
            )}

            {step === 'done' && (
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Transfer More
                </button>
                <Link
                  href={`/wallet/${destWallet}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  View Recipient Wallet →
                </Link>
                <Link
                  href={`/wallet/${sourceWallet}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  View Source Wallet →
                </Link>
              </div>
            )}
          </div>

          {/* Transaction log */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Transaction Log</p>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 flex flex-col gap-1.5 font-mono text-xs">
              {log.length === 0 && <p className="text-zinc-600">No entries yet…</p>}
              {log.map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-zinc-600 shrink-0">{line.ts}</span>
                  <span className={
                    line.kind === 'ok' ? 'text-green-400' :
                    line.kind === 'err' ? 'text-red-400' :
                    line.kind === 'powerup' ? 'text-amber-400' :
                    'text-zinc-400'
                  }>
                    {line.kind === 'ok' && '✓ '}
                    {line.kind === 'err' && '✗ '}
                    {line.kind === 'powerup' && '⚡ '}
                    {line.text}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
