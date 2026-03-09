# AI Changelog

Records of significant features and fixes made by AI agents.

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
