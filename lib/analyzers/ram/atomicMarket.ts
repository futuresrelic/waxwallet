// ─── AtomicMarket Tables RAM Analyzer ────────────────────────────────────────
// Open sales, auctions, and buy-offers hold RAM until cancelled.
// Confidence: "likely" — secondary index scans may miss edge cases.

import type { AnalyzerResult, CleanupItem, TableQueryFn } from '../types';
import {
  buildListingLinks,
  buildBuyOfferLinks,
  buildProfileLinks,
} from '@/lib/link-builders';

// Approximate RAM cost per row based on AtomicMarket contract struct sizes
const BYTES_PER_SALE      = 350;
const BYTES_PER_AUCTION   = 400;
const BYTES_PER_BUYOFFER  = 300;
const BYTES_PER_BALANCE   = 280;

interface SaleRow { sale_id?: number | string; [k: string]: unknown }

export async function analyzeAtomicMarketTables(
  account: string,
  query: TableQueryFn,
): Promise<AnalyzerResult> {
  const rows: AnalyzerResult['rows'] = [];
  const cleanupItems: CleanupItem[] = [];
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
    }) as SaleRow[];

    const count = r.length;
    totalSuspects += count;

    rows.push({
      label: 'Open sale listings (you as seller)',
      value: count,
      detail: count > 0
        ? `~${(count * BYTES_PER_SALE).toLocaleString()} bytes — cancel from marketplace UI to reclaim RAM`
        : 'None found',
    });

    if (count > 0) {
      cleanupItems.push({
        id: 'am_sales',
        title: `${count} open sale listing${count > 1 ? 's' : ''}`,
        count,
        estimatedBytes: count * BYTES_PER_SALE,
        reclaimable: 'yes',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'Cancel listings on the marketplace — each cancellation frees ~350 bytes.',
        payerNote: 'You (as seller) are the RAM payer for each listing row.',
        actionLinks: buildListingLinks(account),
      });
    }
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
        ? `~${(count * BYTES_PER_AUCTION).toLocaleString()} bytes — cancel from marketplace UI`
        : 'None found',
    });

    if (count > 0) {
      cleanupItems.push({
        id: 'am_auctions',
        title: `${count} open auction${count > 1 ? 's' : ''}`,
        count,
        estimatedBytes: count * BYTES_PER_AUCTION,
        reclaimable: 'yes',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'Cancel auctions from the marketplace UI (only possible before first bid).',
        payerNote: 'You (as seller) hold the RAM for each active auction row.',
        actionLinks: buildListingLinks(account),
      });
    }
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
        ? `~${(count * BYTES_PER_BUYOFFER).toLocaleString()} bytes — cancel to recover RAM`
        : 'None found',
    });

    if (count > 0) {
      cleanupItems.push({
        id: 'am_buyoffers',
        title: `${count} open buy offer${count > 1 ? 's' : ''}`,
        count,
        estimatedBytes: count * BYTES_PER_BUYOFFER,
        reclaimable: 'yes',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'Cancel your buy offers from the marketplace UI.',
        payerNote: 'You (as buyer) pay RAM for each buy offer row you created.',
        actionLinks: buildBuyOfferLinks(account),
      });
    }
  } catch (e) {
    errors.push('buyoffers: ' + String(e));
    rows.push({ label: 'Open buy offers', value: 'error', detail: String(e) });
  }

  // ── AtomicMarket balance entry (deposited WAX) ─────────────────────────────
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
        label: 'AtomicMarket WAX deposit balance entry',
        value: r.length,
        detail: `~${r.length * BYTES_PER_BALANCE} bytes — withdraw deposited WAX to reclaim`,
      });
      cleanupItems.push({
        id: 'am_balance',
        title: 'AtomicMarket WAX deposit',
        count: r.length,
        estimatedBytes: r.length * BYTES_PER_BALANCE,
        reclaimable: 'yes',
        confidence: 'confirmed',
        payer: 'me',
        howToReclaim: 'Withdraw your deposited WAX from AtomicMarket. Row deleted on full withdrawal.',
        payerNote: 'AtomicMarket deposit balance rows are owned by your account.',
        actionLinks: buildProfileLinks(account),
      });
    }
  } catch {
    // Non-fatal
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
    cleanupItems,
    notes: [
      totalSuspects > 0
        ? `${totalSuspects} open rows — "likely" because secondary index scans may miss edge cases.`
        : null,
      errors.length > 0
        ? `Some reads had errors: ${errors.join('; ')}`
        : null,
    ].filter(Boolean).join(' ') || undefined,
  };
}
