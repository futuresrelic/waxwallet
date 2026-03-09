// ─── AtomicHub URL builders ───────────────────────────────────────────────────
// WAX mainnet. All links open on wax.atomichub.io.

const BASE = 'https://wax.atomichub.io';

export const atomicHub = {
  /** Wallet profile — shows all inventory and activity. */
  profile:    (account: string)     => `${BASE}/profile/${account}`,
  /** Profile filtered to trading (P2P offers). */
  trading:    (account: string)     => `${BASE}/profile/${account}#trading`,
  /** Profile filtered to market listings. */
  listings:   (account: string)     => `${BASE}/profile/${account}#listings`,
  /** Profile filtered to buy offers. */
  buyOffers:  (account: string)     => `${BASE}/profile/${account}#buyoffers`,
  /** A specific sale by ID. */
  sale:       (saleId: string | number) => `${BASE}/trading/sale/${saleId}`,
  /** A specific auction by ID. */
  auction:    (auctionId: string | number) => `${BASE}/trading/auction/${auctionId}`,
  /** Collection explorer page. */
  collection: (name: string)        => `${BASE}/explorer/collection/${name}`,
  /** Template page inside a collection. */
  template:   (collection: string, templateId: string) =>
    `${BASE}/explorer/template/${collection}/${templateId}`,
};
