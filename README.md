# WAX Wallet Viewer

An AtomicAssets-powered NFT browser for the WAX blockchain. Browse, filter, and inspect any WAX wallet's NFT collection with a smooth, fast experience — similar to what AtomicHub used to provide.

---

## Features

- **Wallet browser** — Enter any WAX account name and browse all NFT assets
- **Asset grid** — Responsive grid with lazy-loaded images and video previews
- **Filtering** — Collection, schema, template ID, keyword search, media type, burned assets
- **Sorting** — Newest/oldest, alphabetical, mint number
- **Asset detail page** — Full media preview, all attributes, raw JSON expandable
- **Wallet connect** — WAX Cloud Wallet and Anchor via WharfKit
- **Shareable URLs** — All filters reflected in the query string
- **Endpoint fallback** — Automatic failover across multiple AtomicAssets API nodes
- **Admin panel** — `/admin` — Manage endpoints, view health, configure featured/blocked collections

---

## Routes

| Route | Description |
|---|---|
| `/` | Landing page — search or connect wallet |
| `/wallet/[account]` | Asset browser for a WAX account |
| `/asset/[assetId]` | Full asset detail view |
| `/admin` | Admin panel (password protected) |
| `/api/assets` | Proxy: fetch assets by owner |
| `/api/asset/[assetId]` | Proxy: fetch single asset |
| `/api/collections` | Proxy: fetch account collection summary |
| `/api/schemas` | Proxy: fetch schemas for a collection |
| `/api/health` | Public health status (no auth required) |
| `/api/admin/login` | POST — admin login |
| `/api/admin/logout` | POST — admin logout |
| `/api/admin/config` | GET/POST — admin config (auth required) |
| `/api/admin/status` | GET — system status (auth required) |

---

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Steps

```bash
# 1. Clone the repo and switch to this branch
git clone https://github.com/futuresrelic/waxwallet.git
cd waxwallet
git checkout claude/wax-wallet-viewer-ynUSH

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and set ADMIN_PASSWORD

# 4. Run the dev server
npm run dev

# 5. Open http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_PASSWORD` | **Yes** | `changeme` | Password for `/admin` panel |
| `ATOMICASSETS_ENDPOINTS` | No | (4 public nodes) | Comma-separated list of AtomicAssets API base URLs |
| `FEATURED_COLLECTIONS` | No | — | Comma-separated collection names to highlight |
| `BLOCKED_COLLECTIONS` | No | — | Comma-separated collections to hide |

---

## Railway Deployment

### One-time setup

1. Go to [railway.app](https://railway.app) and create a new project
2. Click **Deploy from GitHub repo** -> connect your GitHub account -> select `futuresrelic/waxwallet`
3. Railway will detect the branch. Make sure it uses `claude/wax-wallet-viewer-ynUSH`
4. Under **Variables**, add:
   - `ADMIN_PASSWORD` = something strong (e.g. `hunter2secure!`)
   - Optionally: `ATOMICASSETS_ENDPOINTS` (defaults are fine to start)
5. Click **Deploy**
6. Railway will build and deploy automatically. Copy the generated URL.

### Subsequent deploys

Push to `claude/wax-wallet-viewer-ynUSH` — Railway picks up changes automatically.

### Custom domain

In Railway project settings -> **Domains** -> add your domain and point DNS as instructed.

---

## Troubleshooting

### What logs to check

- **Railway**: Project -> **Deployments** -> click deployment -> **View Logs**
- **Health check**: Visit `https://your-app.railway.app/api/health` — shows active endpoint, recent errors
- **Admin panel**: `https://your-app.railway.app/admin` — detailed error log + endpoint latencies

### Common failures

#### Images/videos not loading
- This is almost always an IPFS gateway issue. The app automatically tries 3 gateways (ipfs.io -> cloudflare-ipfs.com -> pinata.cloud).
- If all fail, check if the IPFS hash in the asset's `img` attribute is valid.

#### CORS errors in the browser
- All AtomicAssets calls are proxied through the Next.js API routes — the browser never calls them directly.
- If you see CORS, something is calling external APIs from the client. Check the browser network tab.

#### Rate limiting / 429 errors
- The app has server-side caching (30s for assets, 60s for collections).
- Add more endpoints in the admin panel under "API Endpoints".
- Public WAX AtomicAssets nodes to add:
  - `https://wax.api.atomicassets.io`
  - `https://aa.wax.blacklusion.io`
  - `https://wax-aa.eu.eosamsterdam.net`
  - `https://atomic.wax.eosrio.io`
  - `https://wax-atomic.eosiomadrid.io`

#### One API endpoint is down
- The app automatically falls back to the next endpoint in the pool after 30s cooldown.
- Go to `/admin` -> "System Status" to see which endpoint is active and which is failing.
- You can reorder or remove endpoints there.

#### Admin password not working
- Make sure `ADMIN_PASSWORD` is set as an environment variable in Railway (not just locally).
- The session expires after 8 hours and on app restart.

#### App not building on Railway
- Check that Node.js version is 18+ (Railway defaults are fine)
- The build command is `npm run build` and the start command is `npm start` — these are set in `railway.json`

### How to add/rotate endpoints

1. Visit `/admin` -> login
2. Under "API Endpoints", add a URL and click the `+` button
3. Click "Save Configuration"
4. The endpoint pool updates immediately — no restart needed

> **Note**: Endpoint config is in-memory only. If Railway restarts the app (e.g. after a new deploy), it reads back from the `ATOMICASSETS_ENDPOINTS` environment variable. To make changes permanent, update that env var in Railway.

---

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS** — styling
- **TanStack React Query** — data fetching + caching
- **Zustand** — client state
- **WharfKit** — wallet connect (WAX Cloud Wallet + Anchor)
- **AtomicAssets API** — NFT data
- **Railway** — hosting
