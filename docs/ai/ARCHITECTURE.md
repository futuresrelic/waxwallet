# Architecture — Non-Negotiable Rules

These rules prevent regressions and architectural drift.
Do not violate them without updating this document and getting explicit approval.

---

## 1. Server vs Client Boundary

### Server-only code
- `lib/api/atomicassets.ts` — NEVER import in client components
- `lib/endpoint-pool.ts` — NEVER import in client components
- `lib/admin-auth.ts` — NEVER import in client components
- `lib/template-links-store.ts` — NEVER import in client components
- All `app/api/**/route.ts` files — always `export const runtime = 'nodejs'`

### Client-only code
- `lib/wallet.ts` — WharfKit is browser-only; lazy-loaded via dynamic import
- `lib/store.ts` — Zustand with localStorage persistence; server import will break
- All pages/components with `'use client'` directive

### Rules
- Client components fetch data through internal `/api/*` routes only
- Server components (without `'use client'`) may call lib functions directly
- **Never** bypass the API layer from client code to call AtomicAssets directly

---

## 2. API Route Rules

- Every route file must have `export const runtime = 'nodejs'`
- Routes proxy to AtomicAssets via `lib/api/atomicassets.ts`, never fetch external APIs directly
- All routes return `{ success: boolean, data?: T, error?: string }` shape
- Error responses use appropriate HTTP status codes (400, 401, 502)
- Admin routes must call `isValidSession(cookie)` before any data access
- Set appropriate `Cache-Control` headers on every successful response

---

## 3. Data Access Patterns

- AtomicAssets API path: always `{endpoint}/atomicassets/v1/{path}`
- Endpoint selection: always via `pickEndpoint()` from `endpoint-pool.ts`
- Report success/failure: always call `markSuccess()` or `markFailure()` after each request
- Template data: merged order is `template.immutable_data` < `immutable_data` < `mutable_data` < `data`
- Media resolution: use `getAssetMedia()` and `resolveMediaUrl()` from `lib/types.ts`

---

## 4. State Management Rules

- **Server state**: React Query (useQuery) — no manual fetch+useState for API data
- **Global client state**: Zustand store (connectedAccount only)
- **URL state**: filters are stored in URL search params on the wallet page
- **Admin config**: in-memory only (reset on restart); endpoints via `setEndpoints()`, collections via `adminConfig` object in `app/api/admin/config/route.ts`
- **Template links**: in-memory Map backed by optional JSON file at `$DATA_DIR/template-links.json`
- Do not add more Zustand slices without a strong reason; prefer URL state for page-specific data

---

## 5. Authentication

- Admin auth is a simple in-memory session Set (not a database, not JWT)
- Sessions are created by `createSession()` and validated by `isValidSession()`
- Session tokens are stored in cookie `wax_admin_session`
- Sessions **do not expire** and **reset on process restart** — this is intentional for simplicity
- Do not add role-based auth or per-user sessions without redesigning this layer

---

## 6. Endpoint Pool

- Singleton per Node.js process (`pool: Map<string, PoolEntry>`)
- Endpoints are loaded once from env or defaults; can be overridden via `setEndpoints()`
- Failed endpoint cooldown: 30 seconds
- Stats object tracks totalRequests, errorCountLastHour, errors (last 200)
- Do not make the pool distributed (no Redis/DB) — Railway single-instance deployment

---

## 7. UI Import Rules

- Use `@/*` path alias for all imports (configured in tsconfig.json)
- UI primitives live in `components/ui/` — reuse Button, Input, Badge, Spinner before creating new ones
- Class composition: always use `cn()` from `lib/utils.ts` (clsx + tailwind-merge)
- Color theme: dark (zinc-950 base), amber accents, zinc-* for neutrals
- Do not introduce a component library (no shadcn mass-install, no MUI)

---

## 8. Performance Constraints

- Asset list page limit: max 100 per request (enforced in `getAssets()` unless `_uncapped: true`)
- Stack aggregation: max 2000 assets fetched (2 pages × 1000), `_uncapped: true` flag required
- `_uncapped: true` is internal-only — never expose it in public API route params
- Stack aggregation cap: 10 000 assets max; fetched in parallel batches of 3 × 1000
- AtomicAssets request timeout: 10 seconds
- Retry count: 2 attempts with automatic endpoint failover
- React Query: staleTime minimum 15s for assets, 60s for collections/schemas
- Next.js Data Cache: **must not** be used for AtomicAssets fetches (`cache: 'no-store'`); large responses crash the handler

---

## 9. Media Handling

- IPFS hashes starting with `Qm` or `bafy` are resolved via IPFS gateways
- HTTP/HTTPS URLs are used as-is
- `MediaGallery` component (asset detail) and `MediaViewer` (asset cards) both handle gateway fallback
- `collectAllMedia(asset)` in `lib/types.ts` scans all data fields and returns `MediaItem[]`
- Supported media fields (priority order): `video` → `backimg_video` → `img` → `image` → `thumbnail` → `preview` → remaining IPFS/HTTP string fields

---

## 10. File Persistence

- Only `template-links-store.ts` uses file I/O
- Requires `DATA_DIR` env var pointing to a persistent volume
- Without `DATA_DIR`, data is in-memory only (resets on restart)
- Do not add file I/O to other parts of the codebase without a persistent volume strategy
