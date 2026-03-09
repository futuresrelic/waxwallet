// ─── Recommendation Engine ────────────────────────────────────────────────────
// Generates human-readable, actionable recommendations from resource data.
// All logic is heuristic — clearly labelled as such.

import type { WaxAccount, HyperionAction, Recommendation } from './types';

/** Recommend a safe batch size from available CPU (μs). */
export function recommendBatchSize(cpuAvailableUs: number): number {
  // Empirical: atomicassets::transfer costs ~350–500 μs per asset on WAX mainnet.
  // Use 450 μs/asset as baseline; leave 20% headroom.
  const perAsset = 500;
  const safe = Math.floor((cpuAvailableUs * 0.8) / perAsset);
  if (safe >= 150) return 150;
  if (safe >= 100) return 100;
  if (safe >= 50)  return 50;
  if (safe >= 25)  return 25;
  if (safe >= 10)  return 10;
  return Math.max(safe, 1);
}

export function generateRecommendations(
  account: WaxAccount,
  recentActions: HyperionAction[],
  ramSuspectCount: number,
): Recommendation[] {
  const recs: Recommendation[] = [];

  const cpuMax   = account.cpu_limit.max;
  const cpuUsed  = account.cpu_limit.used;
  const cpuAvail = account.cpu_limit.available;
  const netMax   = account.net_limit.max;
  const netUsed  = account.net_limit.used;
  const ramQuota = account.ram_quota;
  const ramUsed  = account.ram_usage;

  const cpuPct = cpuMax > 0 ? (cpuUsed / cpuMax) * 100 : 0;
  const netPct = netMax > 0 ? (netUsed / netMax) * 100 : 0;
  const ramPct = ramQuota > 0 ? (ramUsed / ramQuota) * 100 : 0;

  const batchRec = recommendBatchSize(cpuAvail);

  // ── CPU ──────────────────────────────────────────────────────────────────────
  if (cpuPct > 95) {
    recs.push({
      id: 'cpu_critical',
      severity: 'critical',
      text: 'CPU is critically exhausted — do not start bulk transfers',
      detail: `${cpuPct.toFixed(1)}% used (${cpuAvail.toLocaleString()} μs remaining). PowerUp before attempting any transfers.`,
      action: 'Run PowerUp first',
    });
  } else if (cpuPct > 75) {
    recs.push({
      id: 'cpu_high',
      severity: 'warning',
      text: 'CPU is under pressure',
      detail: `${cpuPct.toFixed(1)}% used. Use a smaller batch size or run a PowerUp before a large transfer.`,
      action: `Recommended batch size: ${batchRec} assets/tx`,
    });
  } else {
    recs.push({
      id: 'cpu_ok',
      severity: 'ok',
      text: 'CPU looks healthy',
      detail: `${cpuPct.toFixed(1)}% used — estimated safe batch size: ${batchRec} assets per transaction.`,
    });
  }

  // ── NET ──────────────────────────────────────────────────────────────────────
  if (netPct > 90) {
    recs.push({
      id: 'net_high',
      severity: 'warning',
      text: 'NET is nearly exhausted',
      detail: `${netPct.toFixed(1)}% used. PowerUp for NET bandwidth before large transfers.`,
      action: 'PowerUp for NET',
    });
  } else if (netPct > 70) {
    recs.push({
      id: 'net_elevated',
      severity: 'info',
      text: 'NET is somewhat elevated',
      detail: `${netPct.toFixed(1)}% used. Monitor before large operations.`,
    });
  }

  // ── RAM ──────────────────────────────────────────────────────────────────────
  if (ramPct > 95) {
    recs.push({
      id: 'ram_critical',
      severity: 'critical',
      text: 'RAM is critically full — wallet cannot receive new tokens or NFTs',
      detail: `${ramPct.toFixed(1)}% used. Cancel open marketplace listings/offers to reclaim RAM immediately.`,
      action: 'Cancel listings/offers',
    });
  } else if (ramPct > 80) {
    recs.push({
      id: 'ram_high',
      severity: 'warning',
      text: 'RAM is getting full',
      detail: `${ramPct.toFixed(1)}% used. Consider cleaning up old market listings or open offers.`,
    });
  }

  // ── RAM suspect count ─────────────────────────────────────────────────────
  if (ramSuspectCount > 50) {
    recs.push({
      id: 'ram_suspects_high',
      severity: 'warning',
      text: `${ramSuspectCount} open marketplace rows detected`,
      detail: 'Each open sale, auction, or buy-offer row occupies RAM. Cancelling recovers it.',
      action: 'Review RAM Suspects section',
    });
  } else if (ramSuspectCount > 10) {
    recs.push({
      id: 'ram_suspects_moderate',
      severity: 'info',
      text: `${ramSuspectCount} open marketplace rows found`,
      detail: 'Cancelling old listings/offers can free up RAM.',
    });
  }

  // ── Bulk transfer readiness summary ──────────────────────────────────────
  if (cpuPct <= 75 && netPct <= 90 && ramPct <= 90) {
    recs.push({
      id: 'bulk_transfer_ready',
      severity: 'ok',
      text: `Ready for bulk transfer — recommended batch size: ${batchRec}`,
      detail: `Based on ${cpuAvail.toLocaleString()} μs available CPU. Auto-PowerUp on the Transfer page will handle overages.`,
    });
  } else if (cpuPct > 75) {
    recs.push({
      id: 'bulk_transfer_limited',
      severity: 'warning',
      text: `Bulk transfer limited — reduce batch to ${batchRec} or less`,
      detail: 'High CPU usage may cause transaction failures. Use smaller batches or PowerUp first.',
    });
  }

  // ── Frequent PowerUps ────────────────────────────────────────────────────
  const powerUps = recentActions.filter(
    a => a.act.account === 'eosio' && a.act.name === 'powerup'
  );
  if (powerUps.length >= 5) {
    recs.push({
      id: 'frequent_powerups',
      severity: 'info',
      text: `${powerUps.length} PowerUp transactions in recent history`,
      detail: 'Frequent PowerUps suggest heavy activity. Consider staking WAX for CPU/NET to reduce costs.',
    });
  }

  return recs;
}
