# AI Changelog — Technical Memory Log

Most recent entry first.
Format: date, what changed, any migration notes.

---

## 2026-02-24 (session 2 — feature refinements)

Added:
- `MediaItem` interface and `collectAllMedia(asset)` helper in `lib/types.ts`
- `components/MediaGallery.tsx` — main viewport + lazy thumbnail strip, IPFS gateway fallback per item
- `rarity?: string` field on `AssetFilters` type
- Rarity filter section (beta) in `FilterPanel.tsx` — hidden when no rarity values in loaded assets

Changed:
- `lib/api/atomicassets.ts` `apiFetch()`: `next: { revalidate: 30 }` → `cache: 'no-store'` (fixes 500s on large responses)
- `lib/api/atomicassets.ts` `getAssets()`: single collection → `collection_name`, multiple → `collection_whitelist`; same pattern for schemas (`schema_name` vs `schema_whitelist`)
- `app/api/stack/route.ts`: cap raised 2000 → 10 000; serial page fetching → parallel batches of 3 (PARALLEL=3)
- `components/AssetGrid.tsx`: prev/next pagination removed; replaced with `useInfiniteQuery` + IntersectionObserver sentinel (300px rootMargin)
- `app/wallet/[account]/page.tsx`: switched to `useInfiniteQuery`; rarity derivation from loaded assets; `rarityValues` passed to FilterPanel
- `app/asset/[assetId]/page.tsx`: `MediaViewer` replaced with `MediaGallery`; burned overlay uses `pointer-events-none`
- `components/FilterPanel.tsx`: added `rarityValues` prop + rarity chips section

Removed:
- `filters.page` URL sync removed for grid view (infinite scroll; page position not bookmarkable)
- `ExternalLink` import removed from asset detail (was unused)

Migration notes:
- No new env vars required
- No DB changes
- Railway deployment: no changes needed; `cache: 'no-store'` takes effect automatically
- `stack` API response: `meta.totalFetched` now up to 10 000 (was 2000); `meta.capped` only true above 10 000

---

## 2026-02-24

Added:
- AI memory system at `/docs/ai/` with 8 files: AI_START_HERE, PROJECT_MAP, ARCHITECTURE, DEV_GUIDE, API_CONTRACTS, FEATURE_REGISTRY, ADMIN_GUIDE, CHANGELOG_AI
- Documents the complete state of the codebase as of this date

Changed:
- Nothing in source code

Removed:
- Nothing

Migration notes:
- None. Documentation-only change.

---

## Prior History (from git log)

### feat(goal-d): add admin-configured Template Links
- Added `TemplateLink` type to `lib/types.ts`
- Added `lib/template-links-store.ts` — in-memory + file-persisted store
- Added `GET /api/template-links` — public enabled links
- Added `GET/POST/PATCH/DELETE /api/admin/template-links` — admin CRUD
- Template links passed as `templateLinksMap` to `AssetGrid` and `TemplateGrid`
- `DATA_DIR` env var enables file persistence at `$DATA_DIR/template-links.json`

### feat(goal-b): add Stack by Template view
- Added `TemplateStack`, `StackMeta`, `StackSortOption` types to `lib/types.ts`
- Added `GET /api/stack` — server-side template aggregation (up to 2000 assets)
- Added `TemplateGrid` component
- Added view mode toggle (grid/stack) to wallet page
- Stack state (sort, page) synced to URL params (`view`, `ssort`, `spage`)
- `_uncapped: true` flag added to `getAssets()` for internal use by stack route

### fix: isolate error boundaries and remove NODE_ENV from env example
- Removed `NODE_ENV` from `.env.example`
- Error boundary fixes

### fix: add global-error.tsx to prevent /_global-error prerender crash
- Added `app/global-error.tsx`

### fix: require Node.js 20+ for Next.js 16 compatibility
- Added `"engines": { "node": ">=20.9.0" }` to `package.json`

### feat: WAX Wallet Viewer — full MVP implementation
- Initial implementation: Next.js 16, AtomicAssets API client, endpoint pool,
  admin auth, wallet connect (WharfKit), asset grid, filters, asset detail,
  admin panel, all API routes
