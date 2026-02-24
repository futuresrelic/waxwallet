# Developer Guide

Action-oriented guide for safely adding features and running the project.

---

## Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

No test runner is currently configured. Verify changes manually via the dev server.

---

## Environment Setup

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Minimum required for local dev:
```
ADMIN_PASSWORD=localdev
```

Optional:
```
ATOMICASSETS_ENDPOINTS=https://wax.api.atomicassets.io,https://aa.wax.blacklusion.io
FEATURED_COLLECTIONS=alienworlds,neftyblocks
BLOCKED_COLLECTIONS=
DATA_DIR=/tmp/waxwallet-data
```

---

## How to Add a New API Route

1. Create `app/api/<name>/route.ts`
2. Add `export const runtime = 'nodejs'` at the top
3. Use `lib/api/atomicassets.ts` for AtomicAssets calls
4. Return `{ success: boolean, data?: T, error?: string }` shape
5. Add `Cache-Control` header on success responses
6. Document the route in `docs/ai/API_CONTRACTS.md`

Example skeleton:
```typescript
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get('owner');
  if (!owner) return NextResponse.json({ error: 'owner is required' }, { status: 400 });

  try {
    // ... logic
    return NextResponse.json(
      { success: true, data: result },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
```

---

## How to Add a New Protected Admin Route

1. Import `isValidSession` and `getSessionCookieName` from `lib/admin-auth`
2. Call `isValidSession(req.cookies.get(getSessionCookieName())?.value)` at the top
3. Return 401 if not valid
4. Document in `docs/ai/ADMIN_GUIDE.md`

---

## How to Add a New Page

1. Create `app/<route>/page.tsx`
2. Add `'use client'` if the page uses hooks, state, or browser APIs
3. Use `useQuery` from `@tanstack/react-query` for server data (via `/api/*` routes)
4. Never call `lib/api/atomicassets.ts` or server-only libs from client pages
5. Use `cn()` from `lib/utils` for class composition
6. Use components from `components/ui/` for primitives

---

## How to Add a New UI Component

1. Reuse existing primitives (Button, Input, Badge, Spinner) first
2. Create in `components/` (feature component) or `components/ui/` (primitive)
3. Use `cn()` for className composition
4. Keep components pure where possible — lift state up

---

## Commit Rules

Follow conventional commits:

```
feat(<scope>): description        — new feature
fix(<scope>): description         — bug fix
chore(<scope>): description       — maintenance, docs, tooling
refactor(<scope>): description    — code restructure, no behaviour change
```

Example scopes: `wallet`, `admin`, `api`, `stack`, `template-links`, `ui`

After a commit that changes code, update the AI docs (see AI_START_HERE.md).

---

## Railway Deploy Notes

- Runtime: Node.js (not Edge)
- Service restarts reset in-memory admin sessions and endpoint health stats
- For persistent template links: mount a Volume at `/data` and set `DATA_DIR=/data`
- Environment variables are set in the Railway service dashboard
- No database required — all persistence is file-based or in-memory

---

## TypeScript Path Alias

Use `@/*` for all imports:
```typescript
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
```

Configured in `tsconfig.json` as `"@/*": ["./*"]`.

---

## Key Types Reference

All shared types live in `lib/types.ts`:

- `AssetData` — full NFT asset from AtomicAssets
- `AssetFilters` — wallet page filter state
- `TemplateStack` — aggregated template with count
- `TemplateLink` — admin-configured CTA button
- `SortOption` / `StackSortOption` — sort enums
- `DEFAULT_FILTERS` — default filter values
- `getAssetMedia(asset)` — resolves media URL + type
- `getAssetName(asset)` — resolves display name
- `resolveMediaUrl(hash)` — converts IPFS hash to URL
