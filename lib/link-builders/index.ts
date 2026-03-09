// ─── Marketplace link builder ─────────────────────────────────────────────────
// Returns a prioritised set of ActionLinks for common cleanup scenarios.
// Callers pick whichever links are most relevant to their context.

import type { ActionLink } from '@/lib/analyzers/types';
import { atomicHub }   from './atomichub';
import { neftyBlocks } from './nefty';

/** Links for managing an account's open market listings/offers. */
export function buildListingLinks(account: string): ActionLink[] {
  return [
    { label: 'Manage on AtomicHub',    href: atomicHub.listings(account),  kind: 'external' },
    { label: 'Manage on NeftyBlocks',  href: neftyBlocks.market(account),  kind: 'external' },
  ];
}

/** Links for managing an account's buy offers. */
export function buildBuyOfferLinks(account: string): ActionLink[] {
  return [
    { label: 'Buy offers on AtomicHub', href: atomicHub.buyOffers(account), kind: 'external' },
    { label: 'Profile on NeftyBlocks',  href: neftyBlocks.market(account),  kind: 'external' },
  ];
}

/** Links for managing P2P trade offers sent by this account. */
export function buildP2POfferLinks(account: string): ActionLink[] {
  return [
    { label: 'Manage P2P offers on AtomicHub', href: atomicHub.trading(account), kind: 'external' },
  ];
}

/** General profile links — useful when a specific sub-page doesn't apply. */
export function buildProfileLinks(account: string): ActionLink[] {
  return [
    { label: 'Profile on AtomicHub',   href: atomicHub.profile(account),   kind: 'external' },
    { label: 'Profile on NeftyBlocks', href: neftyBlocks.profile(account),  kind: 'external' },
  ];
}

/** Collection page links. */
export function buildCollectionLinks(collection: string): ActionLink[] {
  return [
    { label: 'Collection on AtomicHub',   href: atomicHub.collection(collection),   kind: 'external' },
    { label: 'Collection on NeftyBlocks', href: neftyBlocks.collection(collection), kind: 'external' },
  ];
}

/** Link to a specific sale. */
export function buildSaleLink(saleId: string | number, account: string): ActionLink[] {
  return [
    { label: `View sale #${saleId}`, href: atomicHub.sale(saleId), kind: 'external' },
    { label: 'All your listings',    href: atomicHub.listings(account),   kind: 'external' },
  ];
}

export { atomicHub, neftyBlocks };
