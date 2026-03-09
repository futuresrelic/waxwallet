// ─── Minted Assets RAM Analyzer ──────────────────────────────────────────────
// Assets minted where this account is the authorized_minter consume RAM
// that is only reclaimed when the asset owner burns the asset.

import type { AnalyzerResult, CleanupItem } from '../types';

const BYTES_PER_ASSET = 512;

export interface MintedAssetsInfo {
  totalInCollection: number;
  mintedByAccount: number | null; // null = could not determine
  canDetermineRamPayer: boolean;
}

export function analyzeMintedAssets(
  collectionName: string,
  info: MintedAssetsInfo,
  role: { isAuthor: boolean; isAuthorized: boolean },
): AnalyzerResult {
  const rows: AnalyzerResult['rows'] = [];
  const cleanupItems: CleanupItem[] = [];

  rows.push({
    label: 'Total assets in collection',
    value: info.totalInCollection > 0
      ? `${info.totalInCollection.toLocaleString()}${info.totalInCollection >= 1000 ? '+' : ''}`
      : 0,
    detail: 'All assets across all owners.',
  });

  if (info.mintedByAccount !== null) {
    const bytes = info.mintedByAccount * BYTES_PER_ASSET;
    rows.push({
      label: 'Assets where you are authorized_minter',
      value: info.mintedByAccount > 0
        ? `${info.mintedByAccount.toLocaleString()}${info.mintedByAccount >= 1000 ? '+' : ''}`
        : 0,
      detail: info.mintedByAccount > 0
        ? `~${(bytes / 1024).toFixed(1)} KB RAM — reclaimed only when each owner burns their asset`
        : 'None found',
    });

    if (info.mintedByAccount > 0 && (role.isAuthor || role.isAuthorized)) {
      cleanupItems.push({
        id: 'col_minted_assets',
        title: `${info.mintedByAccount.toLocaleString()}+ assets minted by this account`,
        count: info.mintedByAccount,
        estimatedBytes: bytes,
        reclaimable: 'maybe',
        confidence: 'likely',
        payer: 'me',
        howToReclaim: 'RAM is only reclaimed when the OWNER of each asset burns it. You cannot force this. Unsold/gifted assets you still own can be burned directly.',
        payerNote: 'You are the authorized_minter = RAM payer for these asset rows, regardless of who currently owns them.',
        actionLinks: [],
      });
    }
  } else {
    rows.push({
      label: 'Assets minted by this account',
      value: 'unavailable',
      detail: 'The AtomicAssets API does not expose a reliable authorized_minter filter for large collections. Use Hyperion history to count logmint actions by this account.',
    });
  }

  // Explain RAM reclaim mechanics clearly
  rows.push({
    label: 'How to reclaim minted asset RAM',
    value: '—',
    detail: [
      'The RAM for each asset row is reclaimed when the current owner calls burnasset.',
      'If you still own the assets, you can burn them.',
      'If ownership was transferred, you cannot force reclamation.',
    ].join(' '),
  });

  const severity = (info.mintedByAccount ?? 0) > 5000 ? 'warning'
    : (info.mintedByAccount ?? 0) > 500 ? 'info'
    : 'ok';

  return {
    id: 'col_minted_assets',
    title: 'Minted Assets (RAM Payer)',
    description: info.mintedByAccount !== null
      ? `${info.mintedByAccount.toLocaleString()}+ assets where this account paid RAM at mint time.`
      : 'Minted asset count could not be determined.',
    severity,
    confidence: info.canDetermineRamPayer ? 'likely' : 'inferred',
    rows,
    cleanupItems,
    notes: 'RAM payer = the authorized_minter at mint time. Only reclaimed on burnasset by current owner.',
  };
}
