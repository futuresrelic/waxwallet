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
  'eosio:powerup':               '⚡ PowerUp',
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
      : 'CPU N/A';
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
    title: 'Recent Activity',
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
      ? 'Some actions are missing CPU data (older records or history node limitation).'
      : undefined,
  };
}
