// ─── NeftyBlocks URL builders ─────────────────────────────────────────────────
// WAX mainnet. All links open on neftyblocks.com.

const BASE = 'https://neftyblocks.com';

export const neftyBlocks = {
  /** Wallet profile. */
  profile:    (account: string)     => `${BASE}/profile/${account}`,
  /** Wallet profile — market activity tab. */
  market:     (account: string)     => `${BASE}/profile/${account}#market`,
  /** Collection page. */
  collection: (name: string)        => `${BASE}/${name}`,
  /** Collection's templates. */
  templates:  (name: string)        => `${BASE}/${name}/templates`,
};
