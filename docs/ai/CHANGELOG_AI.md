# AI Changelog — Technical Memory Log

Most recent entry first.
Format: date, what changed, any migration notes.

---

## 2026-02-25 (session 4f — Fix: collections double-nesting bug / "No collections" shown)

### Root cause

`getAccountSummary` in `lib/api/atomicassets.ts` misread the AtomicAssets
`/accounts/{owner}` response. That endpoint returns:

```
{ collections: [...], templates: [...], schemas: [...] }
```

`apiFetch()` unwraps `json.data`, so `raw` is the object above. But the old code did:

```typescript
const data = await apiFetch<AccountSummary['collections']>(`/accounts/${owner}`);
return { collections: data };   // wraps the object — double nesting!
```

Resulting API response: `{ data: { collections: { collections: [...] } } }`.

Client fetcher read `json.data?.collections` → got the inner object `{ collections: [...] }`.
`Array.isArray()` guard in FilterPanel turned it into `[]` → "No collections" shown despite
the wallet having many collections.

### Files changed

**`lib/api/atomicassets.ts`** — `getAccountSummary`
- Now typed as `RawAccount | AccountSummary['collections']` to match actual API shape
- Extracts `raw.collections` (the array) when the response is an object; falls back to
  treating `raw` as the array directly when the API returns the array in some environments
- API route now returns `{ data: { collections: [...] } }` (flat, correct shape)

**`app/wallet/[account]/page.tsx`** — `fetchCollections`
- Added robust extraction: tries `json.data.collections` (array) first, then falls back to
  `json.data.collections.collections` (old double-nested shape, e.g. stale CDN cache)
- Added `console.warn` in non-production when the raw value is not an array (dev debugging)

### Behavior after fix
- Collections dropdown populates with real collections on wallet load ✅
- Selecting a collection filters Assets and Templates views correctly ✅
- FilterPanel shows "No collections" only when the wallet genuinely has none ✅
- `npm run build` passes cleanly ✅

---

## 2026-02-25 (session 4e — Fix: Collections always first + Templates attribute filtering)

### Issues fixed

**A: Collections filter was sometimes absent / not first**
- In FilterPanel dropdown mode, the Collections section was wrapped in
  `{collectionOptions.length > 0 && (...)}` — hidden until collections data loaded.
- Same in chips mode: `{safeCollections.length > 0 && (...)}`.
- Fix: always render the Collections section (first, before Schemas and Attributes).
  When `collectionOptions` is empty, show a disabled-looking placeholder ("No collections")
  instead of the Combobox. When data loads, the Combobox appears automatically.
- Ordering is now guaranteed: Collections → Schemas → Template ID → Attributes in both
  dropdown and chips modes.

**B: Templates view attribute filters had no effect**
- `filters.attributes` was absent from the stack React Query key, so React Query never
  refetched when an attribute filter changed.
- `fetchStack` did not pass `a.{key}=value` params to `/api/stack`, so even if the query
  ran, the API ignored attributes.
- `/api/stack` had no mechanism to filter templates by attribute values.

### Architecture for attribute filtering in Templates view

`/api/stack` now builds a `templateAttrs` index during aggregation:
- Reads `asset.template.immutable_data` merged with `asset.immutable_data` for the
  **first asset** of each unique `template_id` (template immutable data is the same
  for all copies of a template).
- Stored as `Record<template_id, Record<field, string[]>>` inside `AggResult`.
- Persisted to cache alongside the `stacks` array.
- **Not** included in the aggregation cache key — same aggregation is reused across all
  attribute filter combinations (attribute filtering is applied post-cache).

Post-cache filtering order (applied before pagination in both code paths):
1. Attribute filter: `Object.entries(attrFilters).every(([k,v]) => templateAttrs[tid][k].includes(v))`
   — AND semantics across multiple `a.*` params
2. Match filter: `name.toLowerCase().includes(match) || template_id.includes(match)`
   — now also matches template_id substrings (e.g. typing "12345" finds that template)

### Files changed

**`app/api/stack/route.ts`**
- Added `templateAttrs: Record<string, Record<string, string[]>>` to `AggResult` interface
- `buildAggregation`: builds `templateAttrs` index from first-asset data per template_id
- Added `filterStacks()` helper — handles both attribute and match filtering pre-pagination
- Route handler: parses `a.{key}=value` params from query string into `attrFilters`
- Both full-scan (background) and cached code paths now use `filterStacks`
- Match filter extended to also check `template_id` (not just template name)
- Old cache entries (missing `templateAttrs`) gracefully fall back to `{}` (no attr filtering
  until cache expires and new entry is written — TTL is 120s)

**`app/wallet/[account]/page.tsx`**
- `fetchStack`: builds `attrParams` from `filters.attributes` and spreads into query string
- Stack query key now includes `filters.attributes` at position 4

**`components/FilterPanel.tsx`**
- Dropdown mode: Collections section always rendered; disabled placeholder shown when empty
- Chips mode: Collections section always rendered; "No collections" note shown when empty
- Both modes: Collections is unconditionally first in render order

### Behavior after fix
- Collections filter is always visible and always first in FilterPanel ✅
- In Templates view: changing any filter (collection, schema, attribute, search) immediately
  triggers a refetch and updates template results ✅
- Attribute filters in Templates view use templateAttrs index (built during aggregation,
  cached alongside stacks) — no extra API calls needed ✅
- Search also matches template_id substrings ✅
- `npm run build` passes cleanly ✅

---

## 2026-02-25 (session 4d — Hotfix: prevent map crash in filter dropdowns)

### Root cause fixed

**`l.map is not a function` still crashing after session 4c fix** — the `TemplateGrid`
guard didn't catch it because the crash was elsewhere:

`Combobox.tsx` computes:
```ts
const filtered = search ? options.filter(...) : options;
```
When `search` is empty (falsy), `filtered = options` directly — no defensive copy.
If `options` is a non-array (e.g. a `Record<string, number>` from facets, or a raw
API response object for `collections`/`schemas`), then `filtered.map(opt => ...)` throws
`l.map is not a function` (where `l` = `filtered` in minified output).

The new dropdown-mode `FilterPanel` computes `collectionOptions = collections.map(...)`
and `schemaOptions = schemas.map(...)` unconditionally at the component top level.
Previously these were inside conditional blocks. So any bad API shape now crashes
immediately on every render, before even reaching Combobox.

### Files changed

**`components/ui/Combobox.tsx`**
- Added `safeOptions = Array.isArray(options) ? options : []` guard
- Added `safeValue = Array.isArray(value) ? value : []` guard
- All internal uses of `options` and `value` replaced with `safeOptions`/`safeValue`
- Bad prop shapes now degrade gracefully (empty list) instead of crashing

**`components/FilterPanel.tsx`**
- Added `safeCollections`, `safeSchemas`, `safeFilterCols`, `safeFilterSchs` guards
- `collectionOptions` and `schemaOptions` computed from safe arrays
- `toggleCollection`, `toggleSchema`, `removeCollection`, `removeSchema`, `activeFilters`
  all use safe arrays
- Added `safeFacets` guard for `attributeFacets` (object vs null/undefined)
- Inner facet values filtered to ensure they are plain objects before use
- All Combobox `value` props use safe arrays
- Chips-mode render loops use safe arrays
- Shows "Filters data invalid — try refresh" banner if `attributeFacets` is corrupted

**`components/AssetGrid.tsx`**
- Added `Array.isArray(assets)` guard before `.length` and `.map` calls
- Shows "Assets data invalid — try refresh" error banner instead of crashing

### Behavior after fix
- `l.map is not a function` crash eliminated across all three components ✅
- Combobox silently degrades to empty list on bad props instead of crashing ✅
- FilterPanel shows graceful error banner on corrupted facets ✅
- AssetGrid shows graceful error banner on corrupted assets ✅
- `npm run build` passes cleanly ✅

---

## 2026-02-25 (session 4c — Fix: Templates view filter reactivity + l.map crash)

### Root causes fixed

**Bug 1: "Templates filter/search does nothing"** — two sub-causes:
1. `stackPage` was never reset to 1 when filters changed. `handleFiltersChange` reset
   `filters.page` (grid page) but `stackPage` is separate state. Changing collection on
   template page 3 would fetch page 3 of the new filter — likely empty — masking the
   filter effect entirely.
2. `filters.search` was absent from the stack query key AND `fetchStack` never passed
   `match` to `/api/stack`, so typing in the search box had zero effect in Templates view.

**Bug 2: `l.map is not a function` (repeating console error)** — `stacks.map()` in
`TemplateGrid` crashes if `stackResult.data` is not an array (stale cache shape, race
condition). No `Array.isArray` guard existed.

### Files changed

**`app/api/stack/route.ts`**
- Accept `match` query param (template name substring search)
- Apply match filter in-memory AFTER loading aggregation from cache, BEFORE paginating
  (cache key unchanged — aggregation is reused across different search terms)
- Both the fast-scan path and the normal cached path apply the match filter

**`app/wallet/[account]/page.tsx`**
- Added `isTemplateStackArray(x)` and `isFacetsResponse(x)` runtime validator functions
- `fetchStack`: passes `match: filters.search || undefined` to API
- `fetchFacets`: uses `isFacetsResponse()` guard before trusting API data
- Stack query key now includes `filters.search` — search changes trigger a refetch
- `handleFiltersChange`: calls `setStackPage(1)` → template pagination resets on any filter change
- `handleClearFilters`: calls `setStackPage(1)` as well

**`components/TemplateGrid.tsx`**
- Added `Array.isArray(stacks)` guard before any `.map` call
- Shows "Templates data invalid — try refresh" error banner instead of crashing

### Behavior after fix
- In Templates view: changing collection/schema → page resets to 1, correct results appear ✅
- In Templates view: typing in search box → filters templates by name in real time ✅
- No more `l.map is not a function` crash — graceful error banner shown instead ✅
- `/api/stack` `match` filter is applied post-cache so aggregation cache is shared ✅

---

## 2026-02-25 (session 4b — Dropdown filter mode + attribute pivot drill-down)

### Dropdown filter mode (`feat: add dropdown filter mode with searchable comboboxes`)

**New file:** `components/ui/Combobox.tsx`
- Lightweight searchable combobox (no external deps)
- Inline-expanding panel (not `position: absolute`) — works inside `overflow-y: auto` containers without clipping
- Supports `multiple` (checkboxes) and single-select (radio-style) with optional per-option count
- Keyboard: Escape closes; outside-click closes; auto-focuses search input on open

**Rewritten:** `components/FilterPanel.tsx`
- Two modes: `dropdown` (default) and `chips` (legacy), toggled via header button
- Mode persisted in `localStorage` (`'wax-filter-mode'`); SSR-safe via `useEffect` hydration
- Dropdown mode: Collections and Schemas use `Combobox` (multi); each attribute group uses `Combobox` (single)
- Applied-filter chips strip: always visible when any filter is active; each chip has an X remove button; "Clear all" when ≥ 2 chips
- Chips mode: original chip-cloud UI preserved exactly
- Props unchanged (no API contract changes)

### Attribute pivot drill-down (`feat: attribute pivot drill-down from asset detail`)

**Modified:** `components/AttributeList.tsx`
- New props: `owner?: string`, `collectionName?: string`
- New helper `isPivotable(value)`: returns true for strings ≤ 80 chars that are not HTTP URLs, `ipfs://` URIs, or IPFS CIDv0/CIDv1 hashes
- When `owner` is provided and a value is pivotable, the value cell renders as a `<Link>` to `/wallet/{owner}?a.{key}={value}&c={collection}` (amber color, underline on hover)
- Non-pivotable values (long strings, URLs, IPFS hashes, numbers) render as plain text, unchanged

**Modified:** `app/asset/[assetId]/page.tsx`
- `AttributeList` for `mergedData`, `template.immutable_data`, and `mutable_data` now receive `owner` and `collectionName`
- New `fetchRelatedAssets(owner, templateId)` fetcher hits `/api/assets?owner=…&template_id=…&limit=13`
- New `useQuery(['related', owner, templateId])` — enabled only when `asset` and `template_id` are available
- "More from this template" panel: grid of up to 12 `AssetCard`s (current asset excluded); "See all →" link to `/wallet/{owner}?t={templateId}`; only shown when ≥ 1 related asset exists

---

## 2026-02-25 (session 4 — Assets view: pagination replaces infinite scroll)

**Option A implemented** — classic Prev/Next pagination for the Assets grid. Infinite scroll
caused the filter sidebar to shift during asset loading, making filters unreachable.

Added:
- Prev/Next pagination controls in `AssetGrid` (mirrors TemplateGrid pattern)
- `page` and `hasNextPage` props on `AssetGrid`; `isFetching` shows spinner inline
- `?pg=N` URL param serialized/parsed for grid page number (omitted when 1)
- `placeholderData: (prev) => prev` on assets query — keeps previous page visible while fetching next, preventing blank flash during navigation

Changed:
- `components/AssetGrid.tsx`: full rewrite — `IntersectionObserver` removed; `hasMore/isFetchingMore/onLoadMore` props replaced by `page/hasNextPage/isFetching/onPageChange`
- `app/wallet/[account]/page.tsx`:
  - `useInfiniteQuery` → `useQuery` (removed `useInfiniteQuery` import, `infiniteKey` memo, `allAssets`, `hasNextPage`, `isFetchingNextPage`, `fetchNextPage`)
  - Assets query key now includes `filters.page`; `filters.page` is the pagination state
  - `assetsHasNextPage = rawAssets.length >= filters.limit` (same heuristic as before)
  - `filtersToSearch` serializes `pg=N` for grid view when page > 1
  - `parseFiltersFromSearch` parses `pg` → `filters.page`
  - Collection quick-chip click now resets `page: 1`
  - Header sub-line updated: "N assets on page X" (was "N assets loaded · scroll for more")

Filter stability:
- Filter panel uses `sticky top-20` — it was already sticky; pagination removes the root cause
  (layout height growth from infinite scroll accumulation)
- All filter changes (collections, schemas, search, sort, attributes, media) continue to reset
  page to 1 via `onChange({ ..., page: 1 })` in FilterPanel and direct handlers

URL behavior:
- Visiting `?pg=3` restores page 3 on load ✅
- Filter/sort change → page resets to 1 → `?pg=` param removed from URL ✅
- Stack view unaffected — uses its own `spage` param ✅

Deprecated:
- Infinite scroll (`IntersectionObserver` auto-trigger) removed from Assets grid
- `FEATURE_REGISTRY.md` updated: "Asset grid infinite scroll" → 🔥 deprecated

---

## 2026-02-25 (session 4 — M14: performance safety)

Added:
- **Request deduplication** in `lib/api/atomicassets.ts`: module-level `inflight: Map<string, Promise<unknown>>` keyed by path string; if two callers request the same URL concurrently, only one network request is made and both receive the same Promise; map entry removed in `.finally()`
- **Concurrency semaphore**: `MAX_CONCURRENT = 12` cap on simultaneous outbound AtomicAssets requests; `acquireSlot()` / `releaseSlot()` with a FIFO waiter queue; background full-wallet scans (30 PARALLEL×pages) can no longer exhaust the connection pool
- Refactored `apiFetch` into `performFetch` (raw retries + semaphore) + `apiFetch` (dedup wrapper)

Changed:
- `lib/api/atomicassets.ts`: reorganised into three layers: constants (TIMEOUT_MS, MAX_CONCURRENT), semaphore helpers (acquireSlot/releaseSlot), performFetch (retry loop inside try/finally with releaseSlot), apiFetch (dedup Map + shared-Promise logic)

Design notes:
- Dedup fires BEFORE semaphore acquisition — a deduplicated caller doesn't consume a concurrency slot
- Semaphore waiters queue is FIFO; no starvation
- `inflight` and semaphore state are module-level (not global) — reset on HMR restarts, which is correct: a dev HMR restart should not carry stale slot counts or promises

---

## 2026-02-25 (session 4 — M13: full URL state sync)

Added:
- Sort value validation in `parseFiltersFromSearch` — only values present in `SORT_OPTIONS` are accepted; invalid URL params ignored (prevents injection of bad sort keys)
- Backward-compat parsing: old `?rarity=X` URL format (pre-M12 bookmarks/links) → `attributes.rarity = X`
- Idempotent URL sync: `useEffect` compares `window.location.pathname + search` to `newUrl` before calling `router.replace`; skips replace if URL already matches, preventing spurious navigation entries and initial-render flash

Changed:
- `app/wallet/[account]/page.tsx`: `SORT_OPTIONS` added to imports; `parseFiltersFromSearch` validates sort + parses legacy rarity; URL sync effect guards with `if (newUrl !== currentUrl)`

State coverage (all URL-synced):
| State              | URL param          |
|--------------------|--------------------|
| search             | `q`                |
| collections        | `c` (comma-sep)    |
| schemas            | `s` (comma-sep)    |
| templateId         | `t`                |
| sortBy             | `sort` (omitted if default) |
| mediaType          | `media`            |
| showBurned         | `burned=true`      |
| attributes         | `a.{key}={value}`  |
| viewMode           | `view=stack`       |
| stackSort          | `ssort`            |
| stackPage          | `spage`            |

Not in URL (intentional): `stackScanAll` (transient), `showFilterPanel` (UI), `limit` (always 40)

---

## 2026-02-25 (session 4 — M12: dynamic attribute discovery)

Added:
- Dynamic attribute facet discovery in `/api/facets` — scans all string fields in asset data, applies cardinality (≤20 unique values) + coverage (≥5% of scanned assets) filters, returns top 8 fields as `attributes: Record<fieldName, Record<value, count>>`
- `SKIP_FIELDS` set in facets route — ignores img/video/IPFS/URL/metadata fields that are not useful as filters
- `toggleAttribute(key, value)` in `FilterPanel` — generic attribute toggle that updates `filters.attributes` record
- Dynamic attribute sections in FilterPanel — renders one chip group per discovered attribute key; label uses `key.replace(/_/g, ' ')`
- `attributes?: Record<string, string>` field on `AssetFilters` (replaces `rarity?: string`)

Changed:
- `lib/types.ts`: `rarity?: string` → `attributes?: Record<string, string>` in `AssetFilters`
- `app/api/facets/route.ts`: full rewrite — old `{ rarity, schemas, scanned, capped }` → `{ attributes, schemas, scanned, capped }`; `rarity` is now one of the discovered attribute keys if it meets cardinality/coverage criteria
- `components/FilterPanel.tsx`: props `rarityFacets/rarityScanned/rarityCapped` → `attributeFacets/facetsScanned/facetsCapped`; dynamic section rendering; `hasActiveFilters` checks `Object.keys(filters.attributes ?? {}).length`
- `app/wallet/[account]/page.tsx`: `fetchAssetsPage` passes `a.{key}=value` for each attribute (already handled by /api/assets route from M10); `fetchFacets` return type updated; `infiniteKey` uses `attributes`; URL parsing/serialization updated for `a.{key}` params; FilterPanel props shared via `filterPanelProps` object
- Removed `rarityFacets` computed memo from wallet page

Migration notes:
- `/api/facets` response shape changed — clients reading `data.rarity` will get undefined; `data.attributes.rarity` is the new path if rarity qualifies as a low-cardinality field
- Old `?rarity=X` URL params no longer work — replaced by `?a.rarity=X` (new format)
- Different wallets/collections will show entirely different filter sections depending on which attributes their NFTs use

---

## 2026-02-25 (session 4 — M11: background full-wallet indexing)

Added:
- `lib/index-jobs.ts` — module-level in-process job tracker; `isIndexing(key)` + `startIndexJob(key, fn)` prevent duplicate scans; jobs stored on `global._waxJobs` (survives HMR)
- `indexing?: boolean` field added to `StackMeta` in `lib/types.ts` — signals client to poll
- Background scan logic in `/api/stack`: when `scan_pages=10` (full wallet) and cache miss, fires background `buildAggregation()`, immediately returns fast-scan (3-page) partial data with `meta.indexing: true`
- Auto-poll in wallet page: `refetchInterval: (q) => q.state.data?.meta.indexing ? 3000 : false`
- `TemplateGrid` indexing banner: amber "Scanning wallet in background..." bar with spinner while `meta.indexing`; "Load complete wallet" button hidden during active indexing

Changed:
- `app/api/stack/route.ts`: extracted fast/full cache key separation; background job path returns `Cache-Control: no-store` (partial data should not be edge-cached); normal path unchanged
- `components/TemplateGrid.tsx`: added `Loader2` import; indexing banner; "Load complete wallet" hidden while indexing
- `app/wallet/[account]/page.tsx`: added `refetchInterval` to stack query

Behaviour:
- User clicks "Load complete wallet" → `scan_pages=10` sent → server starts background scan → returns 3-page partial immediately → client polls every 3s → when background scan writes to cache, next poll returns full result + `indexing: undefined` → polling stops
- If fast-scan is also uncached on first click: inline 3-page scan runs (fast, ~3s) before returning; result cached for future polls
- If process restarts mid-indexing: job map is cleared; next poll triggers a new background scan transparently

---

## 2026-02-24 (session 4 — M10: server-side cache)

Added:
- `lib/cache.ts` — adapter-based TTL cache; in-memory default (2000-key LRU-evicting Map) with optional Redis backend via ioredis (activated when `REDIS_URL` env var is set)
- `ioredis` dependency (v5) added to package.json; used only when REDIS_URL is configured
- Cache applied to `/api/assets` (TTL 120s), `/api/facets` (TTL 300s), `/api/stack` (TTL 120s)
- Stack route now caches the full sorted `TemplateStack[]` and paginates from the cached array (cache key covers owner/collections/schemas/sort/scan_pages; page is NOT in the cache key)
- `?refresh=true` query param bypasses cache and forces re-fetch on any cached route
- `X-Cache: HIT` response header on cache hits
- Generic attribute filters `a.{key}={value}` parsed in `/api/assets` and passed to `getAssets()` as `template_data.{key}={value}` (groundwork for M12)
- `attr_filters?: Record<string,string>` added to `AssetsQuery` in `lib/api/atomicassets.ts`

Cache strategy:
- Assets: 120s — repeating the same wallet+filter page is instant
- Facets: 300s — attribute distribution changes rarely; long TTL acceptable
- Stack: 120s — aggregation is the slowest operation; all page flips served from cache
- Redis: prefix `wax:*`; EX TTL passed on every SET; connection failure → in-memory fallback
- In-memory: module-level global (survives HMR), LRU eviction at 2000 keys

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
