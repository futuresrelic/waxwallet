// ─── AtomicHub URL builders ───────────────────────────────────────────────────
// WAX mainnet. All links open on wax.atomichub.io.
//
// NOTE: AtomicHub profile URLs include "wax-mainnet" in the path.
// Trading sub-pages (/trading/*) are login-gated but are the correct destination
// for managing open offers — users will see their own offers once logged in.

const BASE = 'https://wax.atomichub.io';

export const atomicHub = {
  // ── Profile pages ──────────────────────────────────────────────────────────

  /** Wallet profile overview. Uses wax-mainnet/ prefix (required by AtomicHub). */
  profile:    (account: string) => `${BASE}/profile/wax-mainnet/${account}`,

  /** Profile page filtered to active listings (sales/auctions). */
  listings:   (account: string) =>
    `${BASE}/profile/wax-mainnet/${account}?order=desc&sort=created&symbol=WAX#listings`,

  /** Profile page filtered to buy-offers this account placed. */
  buyOffers:  (account: string) => `${BASE}/profile/wax-mainnet/${account}#buyoffers`,

  // ── Trading section pages (login-gated, but correct deep destinations) ─────

  /** P2P trade-offers page — shows sent/received offers for the logged-in user. */
  tradeOffersPage: () => `${BASE}/trading/trade-offers`,

  /** Buy-offers page — shows buy offers placed by the logged-in user. */
  buyOffersPage: () => `${BASE}/trading/buy-offers`,

  /** Trading links page — custodial/shareable asset links. */
  tradingLinksPage: () => `${BASE}/trading/links`,

  // ── Sale / auction detail ──────────────────────────────────────────────────

  /** A specific sale by ID. */
  sale:    (saleId: string | number)    => `${BASE}/trading/sale/${saleId}`,

  /** A specific auction by ID. */
  auction: (auctionId: string | number) => `${BASE}/trading/auction/${auctionId}`,

  // ── Collection explorer ────────────────────────────────────────────────────

  /** Collection page. */
  collection: (name: string) => `${BASE}/explorer/collection/${name}`,

  /** Collection templates page. */
  collectionTemplates: (name: string) => `${BASE}/explorer/collection/${name}#templates`,

  /** Template detail page. */
  template: (collection: string, templateId: string) =>
    `${BASE}/explorer/template/${collection}/${templateId}`,
};
