// ─── AtomicAssets Contract RAM Analyzer ──────────────────────────────────────
// Inspects open P2P trade offers sent/received via atomicassets.

import type { AnalyzerResult, TableQueryFn } from '../types';

export async function analyzeAtomicAssetsTables(
  account: string,
  query: TableQueryFn,
): Promise<AnalyzerResult> {
  const rows: AnalyzerResult['rows'] = [];
  let suspectCount = 0;
  const errors: string[] = [];

  // ── Open offers sent by this account (index_position 2 = sender_name) ──────
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
    const count = r.length;
    suspectCount += count;
    rows.push({
      label: 'Open P2P trade offers sent by you',
      value: count,
      detail: count > 0
        ? `~${(count * 500).toLocaleString()} bytes estimated. Cancelling frees RAM.`
        : 'None found',
    });
  } catch (e) {
    errors.push('offers (sent): ' + String(e));
  }

  // ── Open offers received by this account (index_position 3 = recipient_name) ─
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
    const count = r.length;
    rows.push({
      label: 'Open P2P trade offers received',
      value: count,
      detail: count > 0
        ? 'Sender holds RAM for these rows — not you. Accepting or declining clears them.'
        : 'None found',
    });
  } catch (e) {
    errors.push('offers (received): ' + String(e));
  }

  // ── Collection authorizations / notifyaccs ─────────────────────────────────
  // Each collection this account is an authorized_account or notify_account of
  // stores their name in an array — the collection creator bears that RAM.
  // We include this as "inferred" context only.
  rows.push({
    label: 'Collection auth/notify entries',
    value: 'inferred',
    detail: 'If you are an authorized account on collections, the collection contract row holds that RAM (not your wallet). Not directly quantifiable here.',
  });

  const severity = suspectCount > 20 ? 'info' : 'ok';

  return {
    id: 'ram_atomicassets',
    title: 'AtomicAssets P2P Offers',
    description: 'Open direct trade offers sent or received via atomicassets.',
    severity,
    confidence: 'likely',
    rows,
    notes: errors.length > 0
      ? `Some table reads failed (partial results): ${errors.join('; ')}`
      : undefined,
  };
}
