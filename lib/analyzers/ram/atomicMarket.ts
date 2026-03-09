// ─── AtomicMarket Tables RAM Analyzer ────────────────────────────────────────
// Open sales, auctions, and buy-offers hold RAM until cancelled.
// Confidence: "likely" — secondary index scans may miss edge cases.

import type { AnalyzerResult, TableQueryFn } from '../types';

// Approximate RAM cost per row based on AtomicMarket contract struct sizes
const BYTES_PER_SALE      = 350;
const BYTES_PER_AUCTION   = 400;
const BYTES_PER_BUYOFFER  = 300;
const BYTES_PER_TOKENOFFER = 280;

export async function analyzeAtomicMarketTables(
  account: string,
  query: TableQueryFn,
): Promise<AnalyzerResult> {
  const rows: AnalyzerResult['rows'] = [];
  let totalSuspects = 0;
  const errors: string[] = [];

  // ── Open sales (seller = account) ─────────────────────────────────────────
  try {
    const r = await query({
      code: 'atomicmarket',
      scope: 'atomicmarket',
      table: 'sales',
      index_position: '2',
      key_type: 'name',
      lower_bound: account,
      upper_bound: account,
      limit: 1000,
    });
    const count = r.length;
    totalSuspects += count;
    rows.push({
      label: 'Open sale listings (you as seller)',
      value: count,
      detail: count > 0
        ? `~${(count * BYTES_PER_SALE).toLocaleString()} bytes. Cancel to reclaim RAM.`
        : 'None found',
    });
  } catch (e) {
    errors.push('sales: ' + String(e));
    rows.push({ label: 'Open sale listings', value: 'error', detail: String(e) });
  }

  // ── Open auctions (seller = account) ──────────────────────────────────────
  try {
    const r = await query({
      code: 'atomicmarket',
      scope: 'atomicmarket',
      table: 'auctions',
      index_position: '2',
      key_type: 'name',
      lower_bound: account,
      upper_bound: account,
      limit: 500,
    });
    const count = r.length;
    totalSuspects += count;
    rows.push({
      label: 'Open auction listings (you as seller)',
      value: count,
      detail: count > 0
        ? `~${(count * BYTES_PER_AUCTION).toLocaleString()} bytes. Cancel to reclaim RAM.`
        : 'None found',
    });
  } catch (e) {
    errors.push('auctions: ' + String(e));
    rows.push({ label: 'Open auction listings', value: 'error', detail: String(e) });
  }

  // ── Buy offers placed by account ──────────────────────────────────────────
  try {
    const r = await query({
      code: 'atomicmarket',
      scope: 'atomicmarket',
      table: 'buyoffers',
      index_position: '2',
      key_type: 'name',
      lower_bound: account,
      upper_bound: account,
      limit: 1000,
    });
    const count = r.length;
    totalSuspects += count;
    rows.push({
      label: 'Open buy offers (you as buyer)',
      value: count,
      detail: count > 0
        ? `~${(count * BYTES_PER_BUYOFFER).toLocaleString()} bytes. Cancel to recover RAM.`
        : 'None found',
    });
  } catch (e) {
    errors.push('buyoffers: ' + String(e));
    rows.push({ label: 'Open buy offers', value: 'error', detail: String(e) });
  }

  // ── Token offers/deposits ─────────────────────────────────────────────────
  try {
    const r = await query({
      code: 'atomicmarket',
      scope: account,
      table: 'tokenconfigs',
      limit: 10,
    });
    // Ignore — this is the token config table, not deposits
    void r;
  } catch {
    // Non-fatal
  }

  // Try balances table (WAX deposited but not yet spent)
  try {
    const r = await query({
      code: 'atomicmarket',
      scope: 'atomicmarket',
      table: 'balances',
      index_position: 'primary',
      key_type: 'name',
      lower_bound: account,
      upper_bound: account,
      limit: 5,
    });
    if (r.length > 0) {
      totalSuspects += r.length;
      rows.push({
        label: 'AtomicMarket deposit balance entry',
        value: r.length,
        detail: `~${r.length * BYTES_PER_TOKENOFFER} bytes. Withdraw via marketplace to free RAM.`,
      });
    }
  } catch {
    // Non-fatal — not all accounts have deposits
  }

  const severity =
    totalSuspects > 50 ? 'warning' :
    totalSuspects > 10 ? 'info' :
    'ok';

  return {
    id: 'ram_atomicmarket',
    title: 'AtomicMarket Listings & Offers',
    description: 'Open sales, auctions, and buy-offers consume RAM until closed.',
    severity,
    confidence: 'likely',
    rows,
    notes: [
      totalSuspects > 0
        ? `${totalSuspects} open rows found. "Likely" confidence — secondary index scans may miss some edge cases.`
        : null,
      errors.length > 0
        ? `Some reads had errors: ${errors.join('; ')}`
        : null,
    ].filter(Boolean).join(' ') || undefined,
  };
}
