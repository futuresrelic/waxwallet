// ─── Account Resource Analyzer ───────────────────────────────────────────────
// Parses a WAX get_account response into a structured AnalyzerResult.

import type { WaxAccount, AnalyzerResult } from './types';

export function pctUsed(resource: { used: number; max: number }): number {
  return resource.max > 0 ? (resource.used / resource.max) * 100 : 0;
}

export function formatUs(us: number): string {
  if (us >= 1_000_000) return `${(us / 1_000_000).toFixed(2)} s`;
  if (us >= 1_000) return `${(us / 1_000).toFixed(1)} ms`;
  return `${us.toLocaleString()} μs`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes.toLocaleString()} B`;
}

export function parseAccountResources(account: WaxAccount): AnalyzerResult {
  const cpu = account.cpu_limit;
  const net = account.net_limit;
  const ramUsed = account.ram_usage;
  const ramQuota = account.ram_quota;
  const ramAvail = ramQuota - ramUsed;

  const cpuPct = pctUsed(cpu);
  const netPct = pctUsed(net);
  const ramPct = ramQuota > 0 ? (ramUsed / ramQuota) * 100 : 0;

  const rows: AnalyzerResult['rows'] = [
    {
      label: 'CPU',
      value: `${formatUs(cpu.used)} / ${formatUs(cpu.max)}`,
      detail: `${cpuPct.toFixed(1)}% used — ${formatUs(cpu.available)} available`,
    },
    {
      label: 'NET',
      value: `${formatBytes(net.used)} / ${formatBytes(net.max)}`,
      detail: `${netPct.toFixed(1)}% used — ${formatBytes(net.available)} available`,
    },
    {
      label: 'RAM',
      value: `${formatBytes(ramUsed)} / ${formatBytes(ramQuota)}`,
      detail: `${ramPct.toFixed(1)}% used — ${formatBytes(ramAvail)} free`,
    },
  ];

  if (account.self_delegated_bandwidth) {
    rows.push(
      {
        label: 'Staked CPU',
        value: account.self_delegated_bandwidth.cpu_weight,
        detail: 'self-delegated',
      },
      {
        label: 'Staked NET',
        value: account.self_delegated_bandwidth.net_weight,
        detail: 'self-delegated',
      },
    );
  }

  if (account.refund_request) {
    rows.push({
      label: 'Pending unstake refund',
      value: `${account.refund_request.cpu_amount} + ${account.refund_request.net_amount}`,
      detail: `Requested ${account.refund_request.request_time}`,
    });
  }

  const maxPct = Math.max(cpuPct, netPct, ramPct);
  const severity =
    maxPct > 90 ? 'critical' :
    maxPct > 70 ? 'warning' :
    'ok';

  return {
    id: 'account_resources',
    title: 'Resource Overview',
    severity,
    confidence: 'confirmed',
    rows,
  };
}
