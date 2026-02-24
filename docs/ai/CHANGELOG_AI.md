# AI Changelog — Technical Memory Log

Most recent entry first.
Format: date, what changed, any migration notes.

---

## 2026-02-24 (session 3 — M8: media gallery polish)

Added:
- `animation_url` field added to `videoFields` in `collectAllMedia()` — common ERC-1155 / WAX NFT standard field for animated media
- `CopyUrlButton` component in `MediaGallery` — overlay button (top-right of main viewport) that copies current media URL to clipboard; shows Check icon for 1.5s after copy
- `posterUrl?: string` prop on `MainVideo` — video element now shows a poster image while loading; falls back to first image item in gallery

Changed:
- `lib/types.ts`: `videoFields` array in `collectAllMedia()` now includes `animation_url`
- `components/MediaGallery.tsx`: main viewport has copy-URL overlay button; `MainVideo` receives poster from `firstImage?.url`; imports `Copy`, `Check` icons

Migration notes:
- No API or type changes
- `animation_url` is now scanned before the generic field scan, so it appears near the top of the gallery if present

---

## 2026-02-24 (session 3 — M9: admin template links UX)

Added:
- Multiple links per template_id — `templateLinksMap` is now `Map<string, TemplateLink[]>`
- Admin page: search input filters template links by template_id or label
- Admin page: Export button downloads `template-links-YYYY-MM-DD.json` (client-side blob)
- Admin page: Import button reads JSON file → POST each link to admin API with progress message
- `importInputRef` + hidden `<input type="file">` for import flow
- `handleExport()` and `handleImport(file)` functions in admin page

Changed:
- `components/AssetCard.tsx`: `templateLink?: TemplateLink` → `templateLinks?: TemplateLink[]`; renders multiple link rows
- `components/TemplateCard.tsx`: same change as AssetCard
- `components/AssetGrid.tsx`: `templateLinksMap` type changed to `Map<string, TemplateLink[]>`
- `components/TemplateGrid.tsx`: same type change + passes `templateLinks` (array) to TemplateCard
- `app/wallet/[account]/page.tsx`: `templateLinksMap` memo groups by template_id into arrays
- `app/admin/page.tsx`: added imports for Search/Download/Upload/useRef; link list now filtered by search term

Migration notes:
- No API changes; store unchanged (links still keyed by `id`)
- Old single-link-per-template behavior: if only 1 link, card shows 1 link. If multiple, shows all.
- The public `/api/template-links` returns flat array; wallet page groups them client-side

---

## 2026-02-24 (session 3 — M7: progressive stack view)

Added:
- `scan_pages` query param on `GET /api/stack` (default 3, max 10) — each page = 1000 assets, so default = 3000-asset fast scan
- `scanComplete: boolean` field to `StackMeta` type — true when all wallet assets were scanned
- `onLoadAll?: () => void` and `isLoadingAll?: boolean` props on `TemplateGrid`
- `stackScanAll` boolean state in wallet page — when true, passes `scan_pages=10` to fetchStack
- "From first N assets" info badge + "Load complete wallet" button in TemplateGrid toolbar

Changed:
- `app/api/stack/route.ts`: `collectAssets()` now accepts `maxAssets` param; returns `scanComplete`; meta includes `scanComplete`
- `components/TemplateGrid.tsx`: shows scan-incomplete badge and "Load complete wallet" button when `!meta.scanComplete && !meta.capped`
- `app/wallet/[account]/page.tsx`: stack query key includes `stackScanAll`; `handleViewToggle` resets `stackScanAll`

Migration notes:
- Default stack scan is now 3000 assets (was 10,000). This means first load is 3× faster.
- If scan is incomplete, user sees info + "Load complete wallet" button which triggers full scan
- StackMeta.scanComplete is a new field — old clients reading meta will just ignore it

---

## 2026-02-24 (session 3 — M6: schema facet counts)

Added:
- `schemas: Record<string, number>` to `/api/facets` response — schema asset counts from the 2000-asset scan
- `schemaCounts?: Record<string, number>` prop on `FilterPanel` — shows counts on schema chips

Changed:
- `app/api/facets/route.ts`: counts `asset.schema.schema_name` per asset alongside rarity; returns `schemas` map in response
- `components/FilterPanel.tsx`: schema chips now render `{name} ({count})` when count is available from facets
- `app/wallet/[account]/page.tsx`: passes `schemaCounts={facetsData?.schemas}` to FilterPanel

Migration notes:
- No new endpoints or env vars
- Facets response shape changed: added `schemas` key; backward-compatible (new key)

---

## 2026-02-24 (session 3 — M5: server-backed rarity facets)

Added:
- `app/api/facets/route.ts` — GET endpoint that scans up to 2000 assets in 2 parallel batches and returns `{ rarity: Record<string,number>, scanned: number, capped: boolean }`. Cache: 60s/stale120s.
- `attr_rarity?: string` field on `AssetsQuery` in `lib/api/atomicassets.ts` — maps to `template_data.rarity=X` on AtomicAssets API call for server-side filtering
- `fetchFacets()` async function in wallet page — fetches `/api/facets` and returns rarity counts
- `rarityFacets` query in wallet page (key: `['facets', account, collections, schemas]`, staleTime 60s)
- `rarityFacets`, `rarityScanned`, `rarityCapped` props on `FilterPanel` (replaced `rarityValues`)

Changed:
- `app/api/assets/route.ts`: now passes `attr_rarity` query param to `getAssets()`
- `app/wallet/[account]/page.tsx`: rarity now filtered server-side via `attr_rarity`; client-side rarity derivation (`availableRarities`) removed; `displayAssets` memo simplified (only mediaType filter remains client-side)
- `components/FilterPanel.tsx`: rarity chips now show counts (`Common (42)`); "beta" label removed; note shown when scan is capped

Removed:
- `availableRarities` useMemo from wallet page (replaced by server facets)
- Client-side rarity filter from `displayAssets` (now server-side)
- `rarityValues?: string[]` prop from FilterPanel

Migration notes:
- No new env vars required
- Rarity filter now works correctly across full wallet (not just loaded page)
- AtomicAssets `template_data.rarity` param filters on template immutable_data; assets with rarity only in their own immutable_data won't match (known limitation of API)

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
