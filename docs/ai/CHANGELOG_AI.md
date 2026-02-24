# AI Changelog — Technical Memory Log

Most recent entry first.
Format: date, what changed, any migration notes.

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
