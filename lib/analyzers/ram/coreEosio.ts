// ─── Core EOSIO Tables RAM Analyzer ──────────────────────────────────────────
// Inspects staking, refund, REX, and token balance rows.
// These are "confirmed" because they are owned by the account directly.

import type { AnalyzerResult, TableQueryFn } from '../types';

export async function analyzeCoreEosioTables(
  account: string,
  query: TableQueryFn,
): Promise<AnalyzerResult> {
  const rows: AnalyzerResult['rows'] = [];
  let totalEstimatedBytes = 0;
  const errors: string[] = [];

  // ── Delegated bandwidth ────────────────────────────────────────────────────
  try {
    const r = await query({ code: 'eosio', scope: account, table: 'delband', limit: 200 });
    const count = r.length;
    const bytes = count * 140;
    totalEstimatedBytes += bytes;
    if (count > 0) {
      rows.push({
        label: 'Delegated bandwidth rows',
        value: count,
        detail: `~${bytes} bytes — delegations from this account to others`,
      });
    }
  } catch (e) {
    errors.push('delband: ' + String(e));
  }

  // ── Pending unstake refunds ────────────────────────────────────────────────
  try {
    const r = await query({ code: 'eosio', scope: account, table: 'refunds', limit: 5 });
    const count = r.length;
    const bytes = count * 280;
    totalEstimatedBytes += bytes;
    if (count > 0) {
      rows.push({
        label: 'Pending unstake refund',
        value: count,
        detail: `~${bytes} bytes — row removed automatically after 3-day refund period`,
      });
    }
  } catch (e) {
    errors.push('refunds: ' + String(e));
  }

  // ── REX balance ────────────────────────────────────────────────────────────
  try {
    const r = await query({
      code: 'eosio',
      scope: 'eosio',
      table: 'rexbal',
      index_position: 'primary',
      key_type: 'name',
      lower_bound: account,
      upper_bound: account,
      limit: 1,
    });
    if (r.length > 0) {
      totalEstimatedBytes += 300;
      rows.push({ label: 'REX balance entry', value: 1, detail: '~300 bytes' });
    }
  } catch (e) {
    errors.push('rexbal: ' + String(e));
  }

  // ── WAX token balances (eosio.token) ───────────────────────────────────────
  try {
    const r = await query({ code: 'eosio.token', scope: account, table: 'accounts', limit: 50 });
    const count = r.length;
    const bytes = count * 124;
    totalEstimatedBytes += bytes;
    if (count > 0) {
      rows.push({
        label: 'Token balances (eosio.token)',
        value: count,
        detail: `~${bytes} bytes — one row per token type (WAX, WAXP, etc.)`,
      });
    }
  } catch (e) {
    errors.push('eosio.token accounts: ' + String(e));
  }

  // ── AtomicAssets token backing ────────────────────────────────────────────
  // Assets have a scope entry in atomicassets; each scope row is small but exists
  try {
    const r = await query({ code: 'atomicassets', scope: account, table: 'assets', limit: 1 });
    if (r.length > 0) {
      rows.push({
        label: 'AtomicAssets scope entry',
        value: 'present',
        detail: 'Small scope-level entry (~250 bytes). Assets themselves use contract RAM, not your wallet RAM.',
      });
    }
  } catch {
    // Non-fatal — not all accounts have atomicassets scope
  }

  const severity = totalEstimatedBytes > 3000 ? 'info' : 'ok';

  return {
    id: 'ram_core_eosio',
    title: 'Core EOSIO Tables',
    description: 'Staking delegations, refunds, REX positions, and token balances.',
    severity,
    confidence: 'confirmed',
    rows: rows.length > 0 ? rows : [{ label: 'No notable core rows found', value: '—' }],
    notes: [
      totalEstimatedBytes > 0
        ? `Estimated ~${(totalEstimatedBytes / 1024).toFixed(1)} KB from these rows.`
        : null,
      errors.length > 0
        ? `Some reads failed (partial results): ${errors.join('; ')}`
        : null,
    ].filter(Boolean).join(' ') || undefined,
  };
}
