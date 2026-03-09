# AI Changelog

Records of significant features and fixes made by AI agents.

---

## 2026-03-09 — Resource Control Panel + Collection Inspector

### Summary

Major UX upgrade: /resources now reads as a practical control panel for non-technical users. Added plain-language summary, ranked RAM consumer list, CPU pressure breakdown, and split reclaimable/permanent cleanup items. New /collections search page and Collections navbar link.

### Changes to /resources

| Change | Details |
|--------|---------|
| **"What you can do right now"** | Plain-English bullet summary at top: CPU health, RAM health, top reclaimable item, pending refund |
| **"Where Your RAM Is Going"** | Ranked list split into Reclaimable Now / Possibly Reclaimable / Usually Permanent |
| **"Recent CPU Pressure"** | Groups recent actions by type with count, avg CPU, total CPU, and interpretation text |
| **Confidence labels** | "Confirmed" / "Likely" / "Estimated" with hover tooltips explaining precision |
| **Copy IDs button** | CleanupCard shows "Copy IDs" for action links with `kind: 'copy'` |
| **Collection CTA** | Header button + bottom card link to /collections |

### New: /collections search page

- Collection name input → navigates to `/collection/[name]`
- Recently-inspected list (localStorage, up to 5)
- Pre-fills account from connected wallet

### New: `buildCpuPressureSummary()` in `lib/analyzers/recentActions.ts`

Groups Hyperion actions by category and returns per-group CPU stats and interpretation text.

### Navbar

Added **Collections** link (Layers icon), active on `/collection*` paths.

---

## 2026-03-09 — Actionable Cleanup + Collection Analysis

### Part A — Actionable cleanup on /resources

Extended the RAM Suspects page with actionable cleanup data surfaced as `CleanupItem` objects from each analyzer.

**New files:**

| File | Purpose |
|------|---------|
| `lib/analyzers/ram/cleanupOpportunities.ts` | Aggregates `CleanupItem[]` from all analyzer results; sorts by bytes |
| `lib/link-builders/atomichub.ts` | AtomicHub URL builder (profile, listings, buy offers, sale, collection, template) |
| `lib/link-builders/nefty.ts` | NeftyBlocks URL builder (profile, market, collection, templates) |
| `lib/link-builders/index.ts` | Exports `buildListingLinks`, `buildBuyOfferLinks`, `buildP2POfferLinks`, `buildProfileLinks`, `buildCollectionLinks`, `buildSaleLink` |

**Modified files:**

| File | Change |
|------|--------|
| `lib/analyzers/types.ts` | Added `ActionLink`, `CleanupItem` interfaces; `AnalyzerResult.cleanupItems?` field |
| `lib/analyzers/ram/atomicMarket.ts` | Returns `CleanupItem[]` per sales/auctions/buyoffers/balance |
| `lib/analyzers/ram/atomicAssets.ts` | Returns `CleanupItem[]` for sent P2P offers |
| `app/resources/page.tsx` | Added `CleanupCard` component; "Cleanup Opportunities" section with summary bar and sorted item list; per-analyzer cleanup cards inside each `AnalyzerSection` |

**Key design decisions:**
- `reclaimable: 'yes' | 'no' | 'maybe'` — explicit tristate; 'no' items shown as collapsed "permanent RAM obligations"
- `payer: 'me' | 'contract' | 'other' | 'unknown'` — RAM payer attribution
- `ActionLink.kind: 'external' | 'primary' | 'copy'` — typed link rendering
- Cleanup Opportunities section sorted by `estimatedBytes` descending for highest impact first

### Part B — Collection analysis page (/collection/[name])

A new page for NFT collection authors and authorized accounts to understand their RAM obligations.

**New files:**

| File | Purpose |
|------|---------|
| `lib/analyzers/collection/ownership.ts` | Fetches collection metadata, determines role (author/authorized/notify) |
| `lib/analyzers/collection/templates.ts` | Analyzes schema + template RAM (permanent obligations) |
| `lib/analyzers/collection/mintedAssets.ts` | Analyzes minted asset RAM (reclaimable only by asset owner burning) |
| `lib/analyzers/collection/index.ts` | Re-exports all collection analyzers |
| `app/api/chain/collection/route.ts` | API route: fetches from AtomicAssets, runs all 3 analyzers, 60s TTL |
| `app/collection/[name]/page.tsx` | Collection analysis page with role badges, stat cards, RAM summary, analyzer sections |

**RAM semantics:**
- Schemas and templates: `reclaimable: 'no'` — permanently held by AtomicAssets contract
- Minted assets: `reclaimable: 'maybe'` — only when current owner calls `burnasset`
- Collection auth/notify entries: `reclaimable: 'no'`, `payer: 'other'` (contract holds the RAM)

---

## 2026-03-09 — WAX Resource Inspector

**Route:** `/resources`

### What was built

A "task manager" style page for diagnosing CPU, NET, and RAM resource pressure on any WAX wallet. Designed as a practical operator tool — especially useful before/after bulk transfers.

### New files

| File | Purpose |
|------|---------|
| `lib/analyzers/types.ts` | Shared TypeScript interfaces for all analyzers |
| `lib/analyzers/accountResources.ts` | Parses `get_account` response into structured result |
| `lib/analyzers/recentActions.ts` | Labels and summarises Hyperion action history |
| `lib/analyzers/recommendations.ts` | Heuristic recommendation engine + `recommendBatchSize()` |
| `lib/analyzers/ram/coreEosio.ts` | EOSIO staking, refund, REX, token balance rows |
| `lib/analyzers/ram/atomicMarket.ts` | atomicmarket sales / auctions / buy-offers |
| `lib/analyzers/ram/atomicAssets.ts` | atomicassets P2P trade offers |
| `lib/analyzers/ram/index.ts` | Orchestrates all RAM analyzers in parallel |
| `app/api/chain/account/route.ts` | Proxies `get_account` from `wax.greymass.com` (5s TTL) |
| `app/api/chain/history/route.ts` | Proxies Hyperion v2 history (30s TTL, fallback endpoints) |
| `app/api/chain/ram/route.ts` | Runs all RAM analyzers server-side (30s TTL) |
| `app/resources/page.tsx` | Main resource inspector page |

### Data sources

| Data | Source | Confidence | Notes |
|------|--------|-----------|-------|
| CPU / NET / RAM limits | WAX RPC `get_account` | **confirmed** | 5 second TTL |
| Staked / delegated resources | WAX RPC `get_account` | **confirmed** | |
| Recent transactions + CPU/NET per action | Hyperion v2 `get_actions` | **confirmed** | Falls back through 3 endpoints |
| Staking delegation rows | `eosio::delband` table | **confirmed** | |
| Pending refunds | `eosio::refunds` table | **confirmed** | |
| REX balance | `eosio::rexbal` table | **confirmed** | |
| Token balances | `eosio.token::accounts` table | **confirmed** | |
| AtomicMarket open sales | `atomicmarket::sales` secondary index (seller) | **likely** | Secondary index scan |
| AtomicMarket open auctions | `atomicmarket::auctions` secondary index (seller) | **likely** | |
| AtomicMarket buy offers | `atomicmarket::buyoffers` secondary index (buyer) | **likely** | |
| AtomicAssets P2P offers | `atomicassets::offers` secondary indexes 2/3 | **likely** | Sender & recipient |

### Analyzer architecture

Each RAM analyzer receives a `TableQueryFn` parameter — a function that performs a single `get_table_rows` call. This makes analyzers:
- Testable (mock the query function)
- Reusable in different contexts (client calls API route; server calls RPC directly)
- Extensible: add new analyzers in `lib/analyzers/ram/` and register in `ram/index.ts`

### Recommendations engine

`generateRecommendations()` in `lib/analyzers/recommendations.ts` produces actionable items based on:
- CPU %used → PowerUp recommendation + batch size estimate
- NET %used → PowerUp for NET
- RAM %used → cancel listings advice
- Recent PowerUp count → suggest staking instead
- `recommendBatchSize(cpuAvailableUs)` → floor((available * 0.8) / 500 μs per asset)

All recommendations are explicitly labelled as heuristic.

### Navbar / home page

- **Navbar:** Resources link added (Activity icon)
- Note: Home page feature card can be added in a follow-up if desired

---

## 2026-03-09 — Bulk Asset Transfer tool (refinements)

**Route:** `/transfer`

### Fixes applied

- **Asset pagination cap:** `_uncapped` param added to `/api/assets/route.ts` — bypasses the default 100/page cap in `getAssets()`. Transfer tool passes `_uncapped=true` to load full wallets.
- **Collection filter data shape:** `/api/collections` returns `AccountSummary { collections: [{collection: {...}, assets: N}] }`. Fixed `fetchCollections` to navigate the correct nesting.
- **Sort UI:** 6 sort options added (newest/oldest, mint # asc/desc, name A–Z/Z–A).
- **PowerUp modal closed error:** PowerUp was being sent as a separate `transact()` call, opening a second wallet dialog. Fixed: on a CPU/NET error, retry bundles `eosio::powerup` as the first action in the **same** `transact()` call as the transfer.

---

## 2026-03-08 — Initial Bulk Asset Transfer tool

**Route:** `/transfer`

### What was built

- Multi-step UI: Setup → Preview → Transfer → Done
- Setup: source/dest wallet, collection filter chips, memo, batch size, PowerUp toggle
- Preview: loads all transferable non-burned assets (paginated), thumbnail grid with per-asset and per-collection checkboxes
- Transfer: sequential batch execution via WharfKit `session.transact()`, pause/stop, live log
- PowerUp: auto-triggered (bundled in same transaction) on CPU/NET resource errors
- Navbar and Home page feature card added
