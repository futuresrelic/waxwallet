// ─── Config Store ─────────────────────────────────────────────────────────────
// Persists admin configuration (endpoints, featured/blocked collections) to
// DATA_DIR/config.json on the Railway Volume.
//
// Follows the same pattern as template-links-store.ts and branding-store.ts.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface StoredConfig {
  endpoints?: string[];
  featuredCollections?: string[];
  blockedCollections?: string[];
  quickWallets?: string[];
}

function getFilePath(): string | null {
  const dir = process.env.DATA_DIR?.trim();
  if (!dir) return null;
  return join(dir, 'config.json');
}

// In-memory fallback used when DATA_DIR is not set.
let memConfig: StoredConfig = {};
let memLoaded = false;

function readFromDisk(): StoredConfig | null {
  const path = getFilePath();
  if (!path || !existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as StoredConfig;
  } catch (err) {
    console.error('[Config] Failed to read from disk:', err);
    return null;
  }
}

function persist(data: StoredConfig): void {
  const path = getFilePath();
  if (!path) return;
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Config] Failed to write to disk:', err);
  }
}

/**
 * Returns the current config.
 * When DATA_DIR is set, always reads from disk so server components and
 * API route handlers (which may have separate module instances in Next.js)
 * always see the latest saved state.
 * When DATA_DIR is not set, falls back to the in-memory copy updated by saveConfig().
 */
export function getStoredConfig(): StoredConfig {
  const diskData = readFromDisk();
  if (diskData !== null) return diskData;
  // No DATA_DIR or file doesn't exist yet — use in-memory state
  if (!memLoaded) {
    memLoaded = true;
  }
  return { ...memConfig };
}

export function saveConfig(patch: Partial<StoredConfig>): void {
  // Read current state (disk if available, else memory)
  const current = readFromDisk() ?? memConfig;
  const next = { ...current, ...patch };
  // Always update in-memory copy
  memConfig = next;
  memLoaded = true;
  // Persist to disk if DATA_DIR is configured
  persist(next);
}
