# Project Map

## What This Is

WAX Wallet Viewer — a Next.js web app that lets anyone browse, filter, and inspect NFT assets
owned by any WAX blockchain account, using the AtomicAssets REST API.

---

## Stack

| Layer        | Technology                                        |
|--------------|---------------------------------------------------|
| Framework    | Next.js 16.1.6 (App Router)                       |
| Language     | TypeScript 5 (strict)                             |
| Runtime      | Node.js >=20.9.0                                  |
| React        | 19.2.3                                            |
| Styling      | Tailwind CSS 4                                    |
| State        | Zustand 5 (client-only, localStorage persistence) |
| Data fetching| @tanstack/react-query 5 (client), Next.js fetch cache (server) |
| Wallet auth  | @wharfkit/session (WAX Cloud Wallet + Anchor)     |
| Icons        | lucide-react                                      |
| Deploy target| Railway (Node.js runtime, optional Volume at /data)|

---

## Domain Features

| Domain          | Description                                                    |
|-----------------|----------------------------------------------------------------|
| Wallet Browser  | Browse any WAX account's NFTs with filters, pagination         |
| Stack View      | Aggregate assets by template, show unique template counts      |
| Asset Detail    | Full asset metadata, media, attributes, burned status          |
| Template Links  | Admin-configurable CTA buttons on asset/template cards         |
| Admin Panel     | Endpoint management, featured/blocked collections, template links |
| Endpoint Pool   | Multi-endpoint AtomicAssets failover with health tracking      |
| Wallet Connect  | WharfKit login/logout, session persistence                     |

---

## Folder Purpose Map

```
/
├── app/                        Next.js App Router pages and API routes
│   ├── layout.tsx              Root layout: dark theme, Navbar, Providers
│   ├── page.tsx                Home: search form, quick links
│   ├── wallet/[account]/       Wallet browser page (client component)
│   ├── asset/[assetId]/        Asset detail page (server+client)
│   ├── admin/                  Admin dashboard (client component)
│   └── api/
│       ├── assets/             GET paginated asset list
│       ├── asset/[assetId]/    GET single asset
│       ├── collections/        GET collections for account
│       ├── schemas/            GET schemas for collection
│       ├── stack/              GET template-aggregated view
│       ├── template-links/     GET enabled template links (public)
│       ├── health/             GET public endpoint health status
│       └── admin/
│           ├── login/          POST admin login
│           ├── logout/         POST admin logout
│           ├── status/         GET system status (protected)
│           ├── config/         GET/POST endpoint + collection config (protected)
│           └── template-links/ CRUD template links (protected)
│
├── components/
│   ├── ui/                     Reusable primitives: Button, Input, Badge, Spinner
│   ├── Navbar.tsx              Sticky header with nav links and wallet button
│   ├── WalletConnectButton.tsx WharfKit login/logout UI
│   ├── Providers.tsx           React Query provider wrapper
│   ├── MediaViewer.tsx         IPFS-aware image/video renderer with gateway fallback
│   ├── AssetCard.tsx           NFT card (thumbnail, name, collection, mint, burned)
│   ├── AssetGrid.tsx           Paginated grid of AssetCards
│   ├── TemplateGrid.tsx        Paginated grid of TemplateStack cards
│   ├── FilterPanel.tsx         Filter sidebar (search, sort, media, collections, schemas)
│   └── AttributeList.tsx       Expandable attribute table with copy buttons
│
├── lib/
│   ├── types.ts                All shared TypeScript types + media helper fns
│   ├── utils.ts                cn(), shortenAccount(), formatMint(), buildQueryString()
│   ├── store.ts                Zustand store (connectedAccount persisted)
│   ├── wallet.ts               WharfKit integration (lazy-loaded)
│   ├── admin-auth.ts           Password check + in-memory session store
│   ├── endpoint-pool.ts        AtomicAssets endpoint pool + health tracking
│   ├── template-links-store.ts In-memory + optional file-persisted template links
│   └── api/
│       └── atomicassets.ts     AtomicAssets HTTP client (timeout, retry, failover)
│
├── docs/ai/                    AI memory system (this directory)
├── .env.example                Environment variable documentation
├── next.config.ts              Image domain allowlist
├── tsconfig.json               TS config with @/* path alias
└── package.json                Dependencies and scripts
```

---

## Data Flow

### Asset Browsing (Grid View)
```
Browser → /wallet/[account] (client)
  → useQuery → GET /api/assets?owner=...&filters
    → lib/api/atomicassets.ts getAssets()
      → endpoint-pool pickEndpoint()
      → fetch https://<endpoint>/atomicassets/v1/assets?...
    ← AssetData[]
  ← rendered in AssetGrid → AssetCard components
```

### Template Stack View
```
Browser → viewMode=stack
  → useQuery → GET /api/stack?owner=...
    → server collects up to 2000 assets (2x1000 batches)
    → aggregates by template_id → TemplateStack[]
    → sorts + paginates (20/page, max 50)
  ← rendered in TemplateGrid
```

### Template Links
```
Admin → POST /api/admin/template-links → createLink() → file persist
Public → GET /api/template-links → enabled links only
Wallet page → fetchTemplateLinks() → Map<template_id, TemplateLink>
→ passed to AssetGrid / TemplateGrid → rendered as CTA buttons
```

### Admin Auth
```
POST /api/admin/login { password }
  → checkAdminPassword() vs ADMIN_PASSWORD env
  → makeSessionToken() → createSession() (in-memory Set)
  → Set-Cookie: wax_admin_session=<token>

All admin routes → isValidSession(cookie token)
```

---

## Key Services

| Service              | Location                    | Notes                              |
|----------------------|-----------------------------|------------------------------------|
| AtomicAssets client  | lib/api/atomicassets.ts     | Server-only, 10s timeout, 2 retries|
| Endpoint pool        | lib/endpoint-pool.ts        | Singleton per Node process         |
| Template links store | lib/template-links-store.ts | In-memory + optional /data/template-links.json |
| Admin auth           | lib/admin-auth.ts           | In-memory sessions (reset on restart) |
| Wallet               | lib/wallet.ts               | Client-only, lazy-loaded           |
| Global store         | lib/store.ts                | Zustand, persists connectedAccount |

---

## Environment Variables

| Variable                  | Required | Description                                      |
|---------------------------|----------|--------------------------------------------------|
| ADMIN_PASSWORD            | Yes      | Admin panel password (default: "changeme")       |
| ATOMICASSETS_ENDPOINTS    | No       | Comma-separated API URLs (has 4 built-in defaults)|
| FEATURED_COLLECTIONS      | No       | Comma-separated collection names for quick filter |
| BLOCKED_COLLECTIONS       | No       | Comma-separated collections to hide              |
| DATA_DIR                  | No       | Path to persistent volume (e.g. /data on Railway)|

---

## Default AtomicAssets Endpoints

1. https://wax.api.atomicassets.io
2. https://aa.wax.blacklusion.io
3. https://wax-aa.eu.eosamsterdam.net
4. https://atomic.wax.eosrio.io

---

## IPFS Gateways (fallback order)

1. https://ipfs.io/ipfs/
2. https://cloudflare-ipfs.com/ipfs/
3. https://gateway.pinata.cloud/ipfs/

---

## Caching Strategy

| Data              | Cache TTL          | Mechanism                              |
|-------------------|--------------------|----------------------------------------|
| Assets list       | 15s / stale 30s    | HTTP Cache-Control on API route        |
| Stack view        | 60s / stale 120s   | HTTP Cache-Control on API route        |
| Collections       | 60s client         | React Query staleTime                  |
| Schemas           | 60s client         | React Query staleTime                  |
| Template links    | 30s / stale 60s    | HTTP Cache-Control on API route        |
| Asset detail      | 60s / stale 120s   | HTTP Cache-Control on API route        |
| AtomicAssets fetch| not cached         | cache:'no-store' (prevents >2MB crash) |

**Note:** Next.js Data Cache is intentionally bypassed (`cache: 'no-store'`) on all
AtomicAssets HTTP calls to prevent "item over 2MB" 500 errors on large wallets.
