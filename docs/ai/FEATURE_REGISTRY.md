# Feature Registry

Status legend:
- ✅ Implemented and stable
- 🚧 In progress / partially implemented
- 🧪 Experimental
- ❌ Planned but not started
- 🔥 Deprecated / removed

---

## Core Features

| Feature                        | Status | Notes                                                              |
|--------------------------------|--------|--------------------------------------------------------------------|
| WAX account search             | ✅     | Home page search form                                              |
| Asset grid view                | ✅     | Paginated, 40/page default, max 100/page                           |
| Asset detail page              | ✅     | Full metadata, media, attributes, burned status                    |
| Filter panel                   | ✅     | Search, sort, media type, collections, schemas, template ID, burned|
| URL-synced filters             | ✅     | All filters encoded in URL search params                           |
| Collection quick-chips         | ✅     | Top 8 collections shown as clickable chips                         |
| Mobile filter drawer           | ✅     | Slide-in panel on small screens                                    |
| Pagination (prev/next)         | ✅     | In AssetGrid and TemplateGrid                                      |

---

## Stack / Template View

| Feature                        | Status | Notes                                                             |
|--------------------------------|--------|-------------------------------------------------------------------|
| Template stack aggregation     | ✅     | /api/stack endpoint, up to 2000 assets                           |
| TemplateGrid component         | ✅     | Paginated, 20/page, sortable                                      |
| View mode toggle (grid/stack)  | ✅     | UI toggle in wallet page header                                   |
| Stack sort options             | ✅     | count, name, template_id (asc/desc)                               |
| Capped indicator               | ✅     | Shows warning when wallet >2000 assets in stack view              |

---

## Template Links (CTA Buttons)

| Feature                        | Status | Notes                                                             |
|--------------------------------|--------|-------------------------------------------------------------------|
| Public template links API      | ✅     | GET /api/template-links (enabled only)                            |
| Admin CRUD for template links  | ✅     | Full GET/POST/PATCH/DELETE at /api/admin/template-links           |
| File persistence               | ✅     | Optional; requires DATA_DIR env + volume mount                    |
| CTA buttons on asset cards     | ✅     | AssetGrid passes templateLinksMap → AssetCard renders buttons     |
| CTA buttons on template cards  | ✅     | TemplateGrid passes templateLinksMap → TemplateCard renders buttons|

---

## Wallet Connection

| Feature                        | Status | Notes                                                             |
|--------------------------------|--------|-------------------------------------------------------------------|
| WAX Cloud Wallet connect       | ✅     | WharfKit plugin                                                   |
| Anchor wallet connect          | ✅     | WharfKit plugin                                                   |
| Session persistence            | ✅     | restoreSession() on mount; connectedAccount in Zustand            |
| Disconnect                     | ✅     | disconnectWallet() clears session                                 |

---

## Endpoint Management

| Feature                        | Status | Notes                                                             |
|--------------------------------|--------|-------------------------------------------------------------------|
| Multi-endpoint pool            | ✅     | 4 built-in defaults + env override                                |
| Health tracking                | ✅     | failCount, latency, last success/fail per endpoint                |
| 30s cooldown on failed endpoint| ✅     | Automatic                                                         |
| Latency-based selection        | ✅     | Picks fastest healthy endpoint                                    |
| Admin endpoint management      | ✅     | Dynamic update via /api/admin/config POST                         |
| Error log (last 200)           | ✅     | In-memory, shown in admin panel                                   |

---

## Admin Panel

| Feature                        | Status | Notes                                                             |
|--------------------------------|--------|-------------------------------------------------------------------|
| Password auth                  | ✅     | Cookie-based in-memory sessions                                   |
| System status dashboard        | ✅     | Uptime, requests, error rate, endpoint health                     |
| Endpoint list management       | ✅     | Add/remove endpoints, see health                                  |
| Featured collections editor    | ✅     | In-memory, resets on restart                                      |
| Blocked collections editor     | ✅     | In-memory, resets on restart                                      |
| Template links manager         | ✅     | Full CRUD, file-persisted if DATA_DIR set                         |
| Recent errors log              | ✅     | Last 50 errors shown                                              |

---

## Media

| Feature                        | Status | Notes                                                             |
|--------------------------------|--------|-------------------------------------------------------------------|
| IPFS image rendering           | ✅     | ipfs.io → cloudflare → pinata fallback                            |
| IPFS video rendering           | ✅     | Same gateway fallback                                             |
| Direct HTTP URL support        | ✅     | Pass-through                                                      |
| Media type filter              | ✅     | Client-side filter on fetched assets                              |

---

## Planned / Future

| Feature                        | Status | Notes                                                             |
|--------------------------------|--------|-------------------------------------------------------------------|
| Transfer history               | ❌     | Not implemented                                                   |
| Sale/market price lookup       | ❌     | Not implemented                                                   |
| Collection analytics           | ❌     | Not implemented                                                   |
| Persistent admin config (DB)   | ❌     | Currently in-memory; could use Railway Postgres                   |
| Rate limiting on API routes    | ❌     | No rate limiting currently                                        |
