// ─── Server-side TTL Cache ────────────────────────────────────────────────────
// Adapter-based design: in-memory fallback (always available) with optional
// Redis backend (activated when REDIS_URL env var is set and ioredis can connect).
//
// Uses module-level globals so the store survives Next.js HMR re-imports in dev
// and persists across requests in the same Node.js process on Railway.

const DEFAULT_TTL = 120;  // seconds
const MAX_MEM_KEYS  = 2_000;

// ─── In-memory store ─────────────────────────────────────────────────────────

interface MemEntry { v: string; exp: number }

class MemoryStore {
  private readonly store = new Map<string, MemEntry>();

  get(key: string): string | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.exp) { this.store.delete(key); return null; }
    return e.v;
  }

  set(key: string, value: string, ttl: number): void {
    if (this.store.size >= MAX_MEM_KEYS) this.evict();
    this.store.set(key, { v: value, exp: Date.now() + ttl * 1_000 });
  }

  del(key: string): void { this.store.delete(key); }

  private evict(): void {
    const now = Date.now();
    for (const [k, e] of this.store) {
      if (now > e.exp) this.store.delete(k);
    }
    // If still over limit, drop oldest 20 %
    if (this.store.size >= MAX_MEM_KEYS) {
      const n = Math.floor(MAX_MEM_KEYS * 0.2);
      let i = 0;
      for (const k of this.store.keys()) {
        if (i++ >= n) break;
        this.store.delete(k);
      }
    }
  }
}

// ─── Global singletons (survive HMR) ─────────────────────────────────────────

type G = typeof global & {
  _waxMem?: MemoryStore;
  _waxRedis?: unknown;       // ioredis.Redis | null | undefined
  _waxRedisInit?: boolean;   // true once connection attempt has been made
};

const g = global as G;
if (!g._waxMem) g._waxMem = new MemoryStore();
const mem = g._waxMem;

// ─── Redis adapter (lazy, optional) ──────────────────────────────────────────

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, flag: 'EX', ttl: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  status: string;
};

async function getRedis(): Promise<RedisLike | null> {
  // Return cached result of prior connection attempt
  if (g._waxRedisInit) return (g._waxRedis as RedisLike | null) ?? null;
  g._waxRedisInit = true;

  if (!process.env.REDIS_URL) {
    g._waxRedis = null;
    return null;
  }

  try {
    // Dynamic import so the module still works when ioredis is not installed
    const { default: Redis } = (await import('ioredis')) as { default: new (url: string, opts?: unknown) => RedisLike };
    const client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 3_000,
      maxRetriesPerRequest: 1,
    });
    await (client as unknown as { connect(): Promise<void> }).connect?.();
    g._waxRedis = client;
    console.info('[cache] Redis connected at', new URL(process.env.REDIS_URL).hostname);
    return client;
  } catch (err) {
    console.warn('[cache] Redis unavailable, using in-memory cache:', (err as Error).message);
    g._waxRedis = null;
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const CACHE_TTL = DEFAULT_TTL;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedis();
    const raw = redis ? await redis.get(key) : mem.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttl = DEFAULT_TTL): Promise<void> {
  try {
    const json = JSON.stringify(value);
    const redis = await getRedis();
    if (redis) {
      await redis.set(key, json, 'EX', ttl);
    } else {
      mem.set(key, json, ttl);
    }
  } catch {
    // Cache writes are non-fatal
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = await getRedis();
    if (redis) await redis.del(key);
    else mem.del(key);
  } catch {}
}

/**
 * Build a deterministic, human-readable cache key.
 * Empty/undefined params are excluded to keep keys compact.
 */
export function buildCacheKey(
  prefix: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const parts = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '' && params[k] !== false)
    .map((k) => `${k}=${params[k]}`);
  return `wax:${prefix}:${parts.join(':')}`;
}
