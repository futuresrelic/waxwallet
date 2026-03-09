// ─── AtomicAssets Contract RAM Analyzer ──────────────────────────────────────
// Inspects open P2P trade offers sent/received via atomicassets.

import type { AnalyzerResult, CleanupItem, TableQueryFn } from '../types';
import { buildP2POfferLinks } from '@/lib/link-builders';

export async function analyzeAtomicAssetsTables(
  account: string,
  query: TableQueryFn,
): Promise<AnalyzerResult> {
  const rows: AnalyzerResult['rows'] = [];
  const cleanupItems: CleanupItem[] = [];
  let sentCount = 0;
  const errors: string[] = [];

  // ── Open offers SENT by this account (index_position 2 = sender_name) ──────
  try {
    const r = await query({
      code: 'atomicassets',
      scope: 'atomicassets',
      table: 'offers',
      index_position: '2',
      key_type: 'name',
      lower_bound: account,
      upper_bound: account,
      limit: 500,
    });

    sentCount = r.length;
    const bytes = sentCount * 500;

    rows.push({
      label: 'Open P2P trade offers sent by you',
      value: sentCount,
      detail: sentCount > 0
        ? `~${bytes.toLocaleString()} bytes — cancelling frees your RAM`
        : 'None found',
    });

    if (sentCount > 0) {
      cleanupItems.push({
        id: 'aa_offers_sent',
        title: `${sentCount} open P2P trade offer${sentCount > 1 ? 's' : ''} sent`,
        count: sentCount,
        estimatedBytes: bytes,
        reclaimable: 'yes',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'Cancel the sent offers from a marketplace or wallet UI (atomicassets::canceloffer).',
        payerNote: 'You (as sender) are the RAM payer for offers you created.',
        actionLinks: buildP2POfferLinks(account),
      });
    }
  } catch (e) {
    errors.push('offers (sent): ' + String(e));
  }

  // ── Open offers RECEIVED by this account (index_position 3 = recipient_name) ─
  try {
    const r = await query({
      code: 'atomicassets',
      scope: 'atomicassets',
      table: 'offers',
      index_position: '3',
      key_type: 'name',
      lower_bound: account,
      upper_bound: account,
      limit: 500,
    });

    const rcvdCount = r.length;

    rows.push({
      label: 'Open P2P trade offers received',
      value: rcvdCount,
      detail: rcvdCount > 0
        ? 'The SENDER pays RAM for these — not you. Accept or decline to remove them.'
        : 'None found',
    });

    // Not a cleanup item for this account since they are not the RAM payer
    if (rcvdCount > 0) {
      rows.push({
        label: '↳ Action for received offers',
        value: '—',
        detail: 'Accept or decline from any marketplace UI. RAM is held by the sender.',
      });
    }
  } catch (e) {
    errors.push('offers (received): ' + String(e));
  }

  // ── Collection auth/notify context (inferred) ──────────────────────────────
  rows.push({
    label: 'Collection auth/notify entries (inferred)',
    value: 'inferred',
    detail: 'If you are an authorized account on any collection, the collection row holds those entries — NOT your wallet RAM directly.',
  });

  const severity = sentCount > 20 ? 'info' : 'ok';

  return {
    id: 'ram_atomicassets',
    title: 'AtomicAssets P2P Offers',
    description: 'Open direct trade offers sent or received via atomicassets.',
    severity,
    confidence: 'likely',
    rows,
    cleanupItems,
    notes: errors.length > 0
      ? `Some table reads failed (partial results): ${errors.join('; ')}`
      : undefined,
  };
}
