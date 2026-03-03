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

let loaded = false;
let config: StoredConfig = {};

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  const path = getFilePath();
  if (!path || !existsSync(path)) return;
  try {
    const raw = readFileSync(path, 'utf8');
    config = JSON.parse(raw) as StoredConfig;
  } catch (err) {
    console.error('[Config] Failed to load from disk:', err);
  }
}

function persist(): void {
  const path = getFilePath();
  if (!path) return;
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('[Config] Failed to write to disk:', err);
  }
}

export function getStoredConfig(): StoredConfig {
  ensureLoaded();
  return { ...config };
}

export function saveConfig(patch: Partial<StoredConfig>): void {
  ensureLoaded();
  config = { ...config, ...patch };
  persist();
}
