// ─── Branding Store ───────────────────────────────────────────────────────────
// Persists branding settings + uploaded image files to DATA_DIR/branding/.
//
// Railway usage:
//   1. Mount a Railway Volume at /data (or any path).
//   2. Set DATA_DIR=/data in your Railway service Variables.
//   3. Upload images and save settings via the Admin panel.
//   Without DATA_DIR, settings reset on deploy and image uploads are rejected.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface BrandingSettings {
  siteTitle: string;
  pwaName: string;
  pwaShortName: string;
  primaryColor: string;
  accentColor: string;
  updatedAt: string | null;
}

const DEFAULTS: BrandingSettings = {
  siteTitle: 'WAX Wallet Viewer',
  pwaName: 'WAX Wallet Viewer',
  pwaShortName: 'WAX Wallet',
  primaryColor: '#f59e0b',
  accentColor: '#92400e',
  updatedAt: null,
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export function getBrandingDir(): string | null {
  const dir = process.env.DATA_DIR?.trim();
  if (!dir) return null;
  return join(dir, 'branding');
}

function getSettingsPath(): string | null {
  const dir = getBrandingDir();
  if (!dir) return null;
  return join(dir, 'settings.json');
}

export function getBrandingImagePath(filename: string): string | null {
  const dir = getBrandingDir();
  if (!dir) return null;
  return join(dir, filename);
}

export function isBrandingImageAvailable(filename: string): boolean {
  const path = getBrandingImagePath(filename);
  return path !== null && existsSync(path);
}

/** Ensure branding directory exists. Returns path or null if DATA_DIR not set. */
export function ensureBrandingDir(): string | null {
  const dir = getBrandingDir();
  if (!dir) return null;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Store helpers ─────────────────────────────────────────────────────────────

// In-memory fallback when DATA_DIR is not set.
let memSettings: BrandingSettings = { ...DEFAULTS };

function readFromDisk(): BrandingSettings | null {
  const path = getSettingsPath();
  if (!path || !existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) as Partial<BrandingSettings> };
  } catch (err) {
    console.error('[Branding] Failed to read settings:', err);
    return null;
  }
}

function persist(data: BrandingSettings): void {
  const path = getSettingsPath();
  if (!path) return;
  try {
    const dir = getBrandingDir()!;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Branding] Failed to write settings:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns current branding settings.
 * When DATA_DIR is set, always reads from disk so layout (server component)
 * and the admin API route (which may have separate module instances in Next.js
 * App Router) always see the latest saved state.
 */
export function getSettings(): BrandingSettings {
  return readFromDisk() ?? memSettings;
}

export function updateSettings(
  patch: Partial<Omit<BrandingSettings, 'updatedAt'>>,
): BrandingSettings {
  const current = readFromDisk() ?? memSettings;
  const next: BrandingSettings = { ...current, ...patch, updatedAt: new Date().toISOString() };
  memSettings = next;
  persist(next);
  return { ...next };
}
