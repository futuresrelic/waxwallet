// ─── Recent Actions Analyzer ──────────────────────────────────────────────────
// Parses Hyperion action history and surfaces resource-pressure clues.

import type { HyperionAction, AnalyzerResult } from './types';
import { formatUs } from './accountResources';

// Actions that tend to be CPU-heavy
const HEAVY_ACTIONS = new Set([
  'transfer', 'logmint', 'logburnasset', 'lognewoffer', 'claimoffer',
  'withdraw', 'deposit', 'assertsale', 'purchasesale', 'cancelsale',
  'cancelauction', 'bidauction', 'payofferram', 'announceauction',
  'createoffer', 'canceloffer', 'mintasset', 'burnasset',
]);

// Human-readable labels for contract::action combos
const ACTION_LABELS: Record<string, string> = {
  'atomicassets:transfer':       'NFT Transfer',
  'atomicassets:logmint':        'NFT Mint',
  'atomicassets:logburnasset':   'NFT Burn',
  'atomicassets:createoffer':    'Create Offer',
  'atomicassets:canceloffer':    'Cancel Offer',
  'atomicassets:claimoffer':     'Claim Offer',
  'atomicmarket:purchasesale':   'Buy Sale',
  'atomicmarket:cancelsale':     'Cancel Sale',
  'atomicmarket:assertsale':     'List for Sale',
  'atomicmarket:announceauction':'Start Auction',
  'atomicmarket:cancelauction':  'Cancel Auction',
  'atomicmarket:bidauction':     'Bid on Auction',
  'atomicmarket:payofferram':    'Pay Offer RAM',
  'eosio:powerup':               'PowerUp',
  'eosio:delegatebw':            'Delegate Bandwidth',
  'eosio:undelegatebw':          'Undelegate Bandwidth',
  'eosio:buyrambytes':           'Buy RAM',
  'eosio:sellram':               'Sell RAM',
  'eosio.token:transfer':        'WAX Transfer',
};

function labelAction(account: string, name: string): string {
  return ACTION_LABELS[`${account}:${name}`] ?? `${account}::${name}`;
}

function isHeavy(name: string): boolean {
  return HEAVY_ACTIONS.has(name);
}

// ── CPU Pressure Summary ───────────────────────────────────────────────────────

export type ActionCategory =
  | 'NFT Transfers'
  | 'NFT Mints'
  | 'NFT Burns'
  | 'Marketplace'
  | 'P2P Offers'
  | 'PowerUps'
  | 'WAX Transfers'
  | 'Resource Ops'
  | 'Other';

function categorize(account: string, name: string): ActionCategory {
  if (account === 'atomicassets') {
    if (name === 'transfer')                   return 'NFT Transfers';
    if (name === 'logmint' || name === 'mintasset') return 'NFT Mints';
    if (name === 'logburnasset' || name === 'burnasset') return 'NFT Burns';
    if (name === 'createoffer' || name === 'canceloffer' || name === 'claimoffer') return 'P2P Offers';
  }
  if (account === 'atomicmarket') return 'Marketplace';
  if (account === 'eosio' && name === 'powerup') return 'PowerUps';
  if (account === 'eosio') return 'Resource Ops';
  if (account === 'eosio.token' && name === 'transfer') return 'WAX Transfers';
  return 'Other';
}

export interface CpuActionGroup {
  category: ActionCategory;
  count: number;
  totalCpuUs: number;
  avgCpuUs: number | null;
  missingCpuCount: number;
  interpretation: string;
}

export interface CpuPressureSummary {
  groups: CpuActionGroup[];
  totalVisibleUs: number;
  mainDriver: ActionCategory | null;
  hasMissingData: boolean;
  actionCount: number;
}

export function buildCpuPressureSummary(actions: HyperionAction[]): CpuPressureSummary {
  const buckets = new Map<ActionCategory, { cpu: number[]; missing: number; total: number }>();

  for (const a of actions) {
    const cat = categorize(a.act.account, a.act.name);
    if (!buckets.has(cat)) buckets.set(cat, { cpu: [], missing: 0, total: 0 });
    const b = buckets.get(cat)!;
    b.total++;
    if (a.cpu_usage_us != null) b.cpu.push(a.cpu_usage_us);
    else b.missing++;
  }

  const groups: CpuActionGroup[] = [];

  for (const [category, { cpu, missing, total }] of buckets) {
    const totalCpuUs = cpu.reduce((s, v) => s + v, 0);
    const avgCpuUs   = cpu.length > 0 ? Math.round(totalCpuUs / cpu.length) : null;

    let interpretation = '';
    if (category === 'NFT Transfers') {
      interpretation = avgCpuUs != null
        ? `Each transfer averaged ${formatUs(avgCpuUs)} CPU — this is your main CPU consumer.`
        : 'NFT transfers are common CPU consumers — cost data is incomplete for this window.';
    } else if (category === 'PowerUps') {
      interpretation = total >= 5
        ? `${total} PowerUps in history — consider staking WAX for CPU to avoid repeated costs.`
        : `${total} PowerUp(s) — one-off resource top-ups.`;
    } else if (category === 'NFT Mints') {
      interpretation = 'Minting actions can be CPU-intensive, especially for large batches.';
    } else if (category === 'Marketplace') {
      interpretation = 'Marketplace actions (list, buy, cancel) use moderate CPU.';
    } else if (category === 'P2P Offers') {
      interpretation = 'P2P offer actions (send/cancel/claim) use moderate CPU and each open offer occupies RAM.';
    } else if (category === 'WAX Transfers') {
      interpretation = 'WAX token transfers are lightweight CPU-wise.';
    } else if (category === 'Resource Ops') {
      interpretation = 'Staking, RAM purchases, and other resource operations.';
    } else {
      interpretation = missing > total / 2
        ? 'CPU data is incomplete for these actions.'
        : `${total} action(s) from other contracts.`;
    }

    groups.push({ category, count: total, totalCpuUs, avgCpuUs, missingCpuCount: missing, interpretation });
  }

  // Sort by total CPU descending (groups with missing data go below those with data)
  groups.sort((a, b) => b.totalCpuUs - a.totalCpuUs || b.count - a.count);

  const totalVisibleUs = groups.reduce((s, g) => s + g.totalCpuUs, 0);
  const hasMissingData = groups.some(g => g.missingCpuCount > 0);
  const mainDriver = groups[0]?.count > 0 ? groups[0].category : null;

  return { groups, totalVisibleUs, mainDriver, hasMissingData, actionCount: actions.length };
}

// ── Recent Actions Analyzer ────────────────────────────────────────────────────

export function analyzeRecentActions(actions: HyperionAction[]): AnalyzerResult {
  if (actions.length === 0) {
    return {
      id: 'recent_actions',
      title: 'Recent Activity',
      description: 'No recent transactions found.',
      severity: 'info',
      confidence: 'confirmed',
      rows: [],
    };
  }

  const totalCpuUs = actions.reduce((s, a) => s + (a.cpu_usage_us ?? 0), 0);
  const heavyCount = actions.filter(a => isHeavy(a.act.name)).length;
  const powerUps = actions.filter(a => a.act.account === 'eosio' && a.act.name === 'powerup');
  const hasMissingCpu = actions.some(a => a.cpu_usage_us == null);

  const rows: AnalyzerResult['rows'] = actions.slice(0, 30).map(a => {
    const ts = new Date(a.timestamp).toLocaleString();
    const cpuStr = a.cpu_usage_us != null
      ? formatUs(a.cpu_usage_us)
      : 'no data';
    const netStr = a.net_usage_words != null
      ? `${(a.net_usage_words * 8).toLocaleString()} B NET`
      : '';
    const heavy = isHeavy(a.act.name) ? ' ⚠' : '';
    return {
      label: labelAction(a.act.account, a.act.name) + heavy,
      value: a.trx_id.slice(0, 10) + '…',
      detail: `${ts} · ${cpuStr}${netStr ? ' · ' + netStr : ''}`,
    };
  });

  const severity = totalCpuUs > 1_000_000 ? 'warning' : 'info';

  return {
    id: 'recent_actions',
    title: 'Recent Transactions',
    description: [
      `${actions.length} actions shown`,
      totalCpuUs > 0 ? `total visible CPU: ${formatUs(totalCpuUs)}` : null,
      heavyCount > 0 ? `${heavyCount} heavy actions (⚠)` : null,
      powerUps.length > 0 ? `${powerUps.length} PowerUp(s) in history` : null,
    ].filter(Boolean).join(' · '),
    severity,
    confidence: 'confirmed',
    rows,
    notes: hasMissingCpu
      ? 'Some actions show "no data" for CPU — this is a history node limitation for older records, not missing transactions.'
      : undefined,
  };
}
