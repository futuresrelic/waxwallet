# Admin Guide

---

## Admin Panel URL

`/admin` — client-rendered React page.

---

## Authentication

### Method
Password-based with in-memory session cookies.

### Flow
1. User submits password via form on `/admin`
2. `POST /api/admin/login { password }` validates against `ADMIN_PASSWORD` env var
3. On success: server creates a random token, stores it in `validSessions` Set, sets `wax_admin_session` cookie
4. All subsequent protected requests validate `wax_admin_session` cookie value against `validSessions`
5. `POST /api/admin/logout` removes token from `validSessions`, clears cookie

### Session model
- **Store**: `Set<string>` in `lib/admin-auth.ts` — single Node.js process
- **No expiry**: sessions persist until process restart or explicit logout
- **No persistence**: sessions reset on every deploy/restart
- **Cookie**: `wax_admin_session`, httpOnly

### Password
Set via `ADMIN_PASSWORD` environment variable. Default (insecure): `changeme`.
**Always set a strong password in production.**

---

## Protected Admin Routes

All routes check `isValidSession()` before execution. Return 401 if invalid.

| Route                              | Method       | Action                                     |
|------------------------------------|--------------|--------------------------------------------|
| /api/admin/login                   | POST         | Authenticate, set cookie                   |
| /api/admin/logout                  | POST         | Clear session and cookie                   |
| /api/admin/status                  | GET          | System status + endpoint health            |
| /api/admin/config                  | GET          | Read current config                        |
| /api/admin/config                  | POST         | Update endpoints/collections/blockedTemplates |
| /api/admin/template-links          | GET          | List all links (including disabled)        |
| /api/admin/template-links          | POST         | Create a link                              |
| /api/admin/template-links          | PATCH        | Update a link                              |
| /api/admin/template-links          | DELETE       | Delete a link (?id=...)                    |

---

## Configurable Settings

### Via /api/admin/config POST

| Setting              | Type      | Persistence  | Description                                        |
|----------------------|-----------|--------------|----------------------------------------------------|
| endpoints            | string[]  | In-memory    | AtomicAssets API URLs; updates live endpoint pool  |
| featuredCollections  | string[]  | In-memory    | Quick-filter chips shown on home/wallet page       |
| blockedCollections   | string[]  | In-memory    | Collections hidden from UI                         |
| blockedTemplates     | string[]  | In-memory    | Template IDs blocked from display                  |

**Note:** All config is in-memory only. It resets on process restart.
To make it permanent, set the values in environment variables:
- `FEATURED_COLLECTIONS` (comma-separated)
- `BLOCKED_COLLECTIONS` (comma-separated)
- `ATOMICASSETS_ENDPOINTS` (comma-separated)

### Template Links

| Setting   | Type    | Persistence            | Description                          |
|-----------|---------|------------------------|--------------------------------------|
| id        | string  | UUID, auto-generated   | Unique link identifier               |
| template_id | string | File/in-memory        | AtomicAssets template ID             |
| label     | string  | File/in-memory         | Button label (e.g. "Claim", "Info")  |
| url       | string  | File/in-memory         | Button destination URL               |
| enabled   | boolean | File/in-memory         | Show/hide button without deleting    |

Template links are persisted to `$DATA_DIR/template-links.json` if `DATA_DIR` is set.
Without `DATA_DIR`, they reset on restart.

---

## System Status Dashboard

Available at `GET /api/admin/status`. Shows:

| Field               | Description                                    |
|---------------------|------------------------------------------------|
| endpoints           | Health status of all configured endpoints      |
| currentEndpoint     | The endpoint that would be picked right now    |
| lastSuccessfulCall  | ISO timestamp of last successful AtomicAssets call |
| errorCountLastHour  | Count of errors in the past 60 minutes         |
| totalRequests       | Total requests since process start             |
| uptimeSeconds       | Seconds since process start                    |
| recentErrors        | Last 50 errors (reversed, most recent first)   |

---

## Endpoint Health Model

Each endpoint in the pool tracks:

| Field           | Description                                  |
|-----------------|----------------------------------------------|
| url             | Endpoint base URL                            |
| healthy         | true if failCount=0 OR last failure >30s ago |
| latencyMs       | Latency of last successful request           |
| lastChecked     | ISO timestamp of last success                |
| lastError       | Last error message (if any)                  |

Endpoint selection priority:
1. Healthy endpoints sorted by latency (fastest first)
2. If all unhealthy: least recently failed endpoint

---

## Railway Volume Setup (for persistent template links)

1. In Railway dashboard: add a Volume to the service
2. Mount path: `/data`
3. Add service variable: `DATA_DIR=/data`
4. Links will now survive deploys and restarts

Without this, template links are in-memory only.
