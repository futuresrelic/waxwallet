// ─── Collection Ownership / Authorization Analyzer ───────────────────────────
// Determines this account's role in a collection and describes RAM obligations.

import type { AnalyzerResult, CleanupItem } from '../types';
import { buildCollectionLinks } from '@/lib/link-builders';

export interface CollectionMeta {
  collection_name: string;
  name: string;
  img?: string;
  author: string;
  authorized_accounts: string[];
  notify_accounts: string[];
  market_fee: number;
  created_at_time: string;
}

export interface AccountRole {
  isAuthor: boolean;
  isAuthorized: boolean;
  isNotify: boolean;
}

export function analyzeOwnership(
  collection: CollectionMeta,
  account: string,
): AnalyzerResult & { role: AccountRole } {
  const role: AccountRole = {
    isAuthor:     collection.author === account,
    isAuthorized: collection.authorized_accounts.includes(account),
    isNotify:     collection.notify_accounts.includes(account),
  };

  const rows: AnalyzerResult['rows'] = [
    { label: 'Collection',            value: collection.collection_name },
    { label: 'Author',                value: collection.author,
      detail: role.isAuthor ? '← this account' : undefined },
    { label: 'Market fee',            value: `${(collection.market_fee * 100).toFixed(2)}%` },
    { label: 'Created',               value: new Date(Number(collection.created_at_time)).toLocaleDateString() },
    { label: 'Authorized accounts',   value: collection.authorized_accounts.join(', ') || '(none)',
      detail: role.isAuthorized ? '← this account is listed' : undefined },
    { label: 'Notify accounts',       value: collection.notify_accounts.join(', ') || '(none)',
      detail: role.isNotify ? '← this account is listed' : undefined },
  ];

  const cleanupItems: CleanupItem[] = [];

  if (role.isAuthor || role.isAuthorized) {
    cleanupItems.push({
      id: 'col_auth_row',
      title: 'Collection auth/notify entries',
      count: collection.authorized_accounts.length + collection.notify_accounts.length,
      estimatedBytes: (collection.authorized_accounts.length + collection.notify_accounts.length) * 60,
      reclaimable: 'no',
      confidence: 'inferred',
      payer: 'other',
      howToReclaim: 'These entries are stored inside the collection row itself. They cannot be individually reclaimed while the collection exists.',
      payerNote: 'The collection author holds the RAM for the collection row, which includes authorized/notify account lists.',
      actionLinks: buildCollectionLinks(collection.collection_name),
    });
  }

  let severity: AnalyzerResult['severity'] = 'info';
  if (!role.isAuthor && !role.isAuthorized && !role.isNotify) severity = 'ok';

  const descParts: string[] = [];
  if (role.isAuthor)     descParts.push('author');
  if (role.isAuthorized) descParts.push('authorized');
  if (role.isNotify)     descParts.push('notify account');

  return {
    id: 'col_ownership',
    title: 'Collection Ownership & Roles',
    description: descParts.length > 0
      ? `This account is: ${descParts.join(', ')}`
      : 'This account has no special role in this collection.',
    severity,
    confidence: 'confirmed',
    rows,
    cleanupItems,
    role,
  };
}
