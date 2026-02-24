# API Contracts

All internal Next.js API routes. Every route uses `runtime = 'nodejs'`.
Response shape: `{ success: boolean, data?: T, error?: string }`.

---

## Public Routes

### GET /api/assets

Fetch a paginated list of assets for a wallet.

**Query params:**
| Param           | Required | Default       | Description                              |
|-----------------|----------|---------------|------------------------------------------|
| owner           | Yes      | —             | WAX account name                         |
| collection_name | No       | —             | Filter by collection                     |
| schema_name     | No       | —             | Filter by schema                         |
| template_id     | No       | —             | Filter by template ID                    |
| match           | No       | —             | Name search (partial match)              |
| sort            | No       | asset_id:desc | Sort field:direction                     |
| page            | No       | 1             | Page number                              |
| limit           | No       | 40            | Items per page (max 100)                 |
| burned          | No       | false         | Include burned assets                    |

**Response:**
```json
{ "success": true, "data": AssetData[] }
```

**Cache-Control:** `s-maxage=15, stale-while-revalidate=30`

---

### GET /api/asset/[assetId]

Fetch a single asset by ID.

**Path param:** `assetId` — AtomicAssets asset ID

**Response:**
```json
{ "success": true, "data": AssetData }
```

**Cache-Control:** `s-maxage=30, stale-while-revalidate=60`

---

### GET /api/collections

Fetch collections owned by an account with asset counts.

**Query params:**
| Param | Required | Description  |
|-------|----------|--------------|
| owner | Yes      | WAX account  |

**Response:**
```json
{
  "success": true,
  "data": {
    "collections": [
      { "collection": CollectionData, "assets": number }
    ]
  }
}
```

**Cache-Control:** `s-maxage=30, stale-while-revalidate=60`

---

### GET /api/schemas

Fetch schemas for a collection.

**Query params:**
| Param           | Required | Description     |
|-----------------|----------|-----------------|
| collection_name | Yes      | Collection name |

**Response:**
```json
{ "success": true, "data": SchemaData[] }
```

**Cache-Control:** `s-maxage=60, stale-while-revalidate=120`

---

### GET /api/stack

Aggregate assets by template for a wallet's stack view.
Fetches up to 10 000 assets server-side (parallel batches of 3 × 1000), groups by template_id, sorts, and paginates.

**Query params:**
| Param           | Required | Default    | Description                                       |
|-----------------|----------|------------|---------------------------------------------------|
| owner           | Yes      | —          | WAX account                                       |
| collection_name | No       | —          | Comma-separated collection filter                 |
| schema_name     | No       | —          | Comma-separated schema filter                     |
| sort            | No       | count:desc | count:desc\|count:asc\|name:asc\|name:desc\|template_id:asc\|template_id:desc |
| page            | No       | 1          | Page number                                       |
| limit           | No       | 20         | Items per page (max 50)                           |

**Response:**
```json
{
  "success": true,
  "data": TemplateStack[],
  "meta": {
    "total": number,
    "page": number,
    "limit": number,
    "capped": boolean,
    "totalFetched": number,
    "noTemplateCount": number
  }
}
```

**Cache-Control:** `s-maxage=60, stale-while-revalidate=120`

**Note:** `capped: true` means the wallet has >10 000 assets; stacking is incomplete.

---

### GET /api/template-links

Returns all **enabled** template links. No auth required.
Used by wallet page to render CTA buttons on asset/template cards.

**Response:**
```json
{ "success": true, "data": TemplateLink[] }
```

**Cache-Control:** `s-maxage=30, stale-while-revalidate=60`

---

### GET /api/health

Public endpoint health status (no auth).

**Response:**
```json
{
  "success": true,
  "data": EndpointHealth[]
}
```

No caching (always fresh).

---

## Admin Routes (Protected)

All admin routes require cookie `wax_admin_session` with a valid token.
Returns `{ error: 'Unauthorized' }` with status 401 if not authenticated.

---

### POST /api/admin/login

**Body:** `{ "password": string }`

**Response (success):**
```json
{ "success": true }
```
Sets `wax_admin_session` cookie (httpOnly, path=/).

**Response (failure):** `{ "error": "Invalid password" }` — 401

---

### POST /api/admin/logout

Clears the session.

**Response:** `{ "success": true }`
Clears `wax_admin_session` cookie.

---

### GET /api/admin/status

System status: endpoint health, request stats, recent errors.

**Response:**
```json
{
  "success": true,
  "data": {
    "endpoints": EndpointHealth[],
    "currentEndpoint": string,
    "lastSuccessfulCall": string | null,
    "errorCountLastHour": number,
    "totalRequests": number,
    "uptimeSeconds": number,
    "recentErrors": Array<{ time: number, endpoint: string, message: string }>
  }
}
```

---

### GET /api/admin/config

Returns current configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "endpoints": string[],
    "featuredCollections": string[],
    "blockedCollections": string[],
    "blockedTemplates": string[]
  }
}
```

---

### POST /api/admin/config

Updates configuration. All fields are optional; only provided fields are updated.

**Body:**
```json
{
  "endpoints": string[],
  "featuredCollections": string[],
  "blockedCollections": string[],
  "blockedTemplates": string[]
}
```

**Note:** Config changes are in-memory only (reset on restart), except endpoints which
update the live `endpoint-pool`.

**Response:** `{ "success": true }`

---

### GET /api/admin/template-links

Returns all template links (including disabled).

**Response:** `{ "success": true, "data": TemplateLink[] }`

---

### POST /api/admin/template-links

Create a new template link.

**Body:**
```json
{
  "template_id": string,   // required
  "url": string,           // required
  "label": string,         // optional, default "View"
  "enabled": boolean       // optional, default true
}
```

**Response:** `{ "success": true, "data": TemplateLink }` — 201

---

### PATCH /api/admin/template-links

Update an existing template link.

**Body:**
```json
{
  "id": string,            // required
  "template_id": string,   // optional
  "label": string,         // optional
  "url": string,           // optional
  "enabled": boolean       // optional
}
```

**Response:** `{ "success": true, "data": TemplateLink }`

---

### DELETE /api/admin/template-links

Delete a template link.

**Query param:** `?id=<id>`

**Response:** `{ "success": true }`

---

## Type Shapes

### AssetData (abbreviated)
```typescript
{
  asset_id: string;
  owner: string;
  name: string;
  template_mint: string;
  collection: { collection_name, name, img?, author, created_at_time };
  schema: { schema_name };
  template?: { template_id, max_supply, issued_supply, immutable_data? };
  immutable_data: Record<string, unknown>;
  mutable_data: Record<string, unknown>;
  data: Record<string, unknown>;
  burned_by_account: string | null;
  burned_at_time: string | null;
  backed_tokens: Array<{ token_symbol, token_contract, amount }>;
}
```

### TemplateStack
```typescript
{
  template_id: string;
  name: string;
  collection_name: string;
  collection_display_name: string;
  schema_name: string;
  image_url: string | null;
  image_type: 'image' | 'video' | 'none';
  count: number;
  max_supply: string;
  issued_supply: string;
  sample_asset_ids: string[];   // up to 5
}
```

### TemplateLink
```typescript
{
  id: string;          // UUID
  template_id: string;
  label: string;
  url: string;
  enabled: boolean;
  created_at: string;  // ISO
  updated_at: string;  // ISO
}
```
